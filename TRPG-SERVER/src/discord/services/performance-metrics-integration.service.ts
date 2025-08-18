import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DiscordPerformanceMonitorService } from './discord-performance-monitor.service'

/**
 * パフォーマンスメトリクス統合サービス
 * Discord操作、API呼び出し、システムリソースの包括的な監視
 */
@Injectable()
export class PerformanceMetricsIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceMetricsIntegrationService.name)

  // システム全体のメトリクス
  private readonly systemMetrics = {
    startTime: Date.now(),
    discord: {
      commandsExecuted: 0,
      eventsProcessed: 0,
      embedsCreated: 0,
      messagesSent: 0,
      channelsCreated: 0,
      errors: 0,
      totalResponseTime: 0
    },
    http: {
      requests: 0,
      responses: 0,
      errors: 0,
      totalResponseTime: 0
    },
    database: {
      queries: 0,
      errors: 0,
      totalResponseTime: 0
    }
  }

  // パフォーマンス傾向分析
  private readonly trends = {
    hourlyStats: new Map<string, any>(),
    dailyStats: new Map<string, any>()
  }

  // アラート設定
  private readonly alertConfig = {
    discordCommandResponseTime: 3000, // 3秒
    httpResponseTime: 1000, // 1秒
    errorRateThreshold: 0.05, // 5%
    memoryUsageThreshold: 800, // 800MB
    consecutiveErrorLimit: 10
  }

  private consecutiveErrors = 0
  private lastHealthCheck = Date.now()

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly discordPerformanceMonitor: DiscordPerformanceMonitorService
  ) {}

  async onModuleInit() {
    this.logger.log('Performance Metrics Integration Service initialized')

    // 起動時のヘルスチェック
    await this.performHealthCheck()

    // 定期監視開始
    this.startPeriodicMonitoring()
  }

  /**
   * Discord コマンド実行監視
   */
  @OnEvent('discord.command.start')
  onDiscordCommandStart(data: { commandName: string; userId: string; guildId?: string }) {
    const timer = this.discordPerformanceMonitor.startApiCall(`command:${data.commandName}`, 'EXECUTE')

    // コマンド実行統計
    this.systemMetrics.discord.commandsExecuted++

    this.logger.debug(`Command started: ${data.commandName} by ${data.userId}`)

    return timer
  }

  @OnEvent('discord.command.complete')
  onDiscordCommandComplete(data: { commandName: string; success: boolean; duration: number; error?: string }) {
    this.systemMetrics.discord.totalResponseTime += data.duration

    if (!data.success) {
      this.systemMetrics.discord.errors++
      this.consecutiveErrors++

      this.logger.warn(`Command failed: ${data.commandName} - ${data.error}`)

      // 連続エラーアラート
      if (this.consecutiveErrors >= this.alertConfig.consecutiveErrorLimit) {
        this.triggerAlert({
          type: 'consecutive-errors',
          severity: 'critical',
          message: `${this.consecutiveErrors} consecutive command errors`,
          data: { commandName: data.commandName, error: data.error }
        })
      }
    } else {
      this.consecutiveErrors = 0
    }

    // 遅いコマンドアラート
    if (data.duration > this.alertConfig.discordCommandResponseTime) {
      this.triggerAlert({
        type: 'slow-command',
        severity: 'warning',
        message: `Command ${data.commandName} took ${data.duration}ms`,
        data: { commandName: data.commandName, duration: data.duration }
      })
    }
  }

  /**
   * Discord イベント処理監視
   */
  @OnEvent('discord.event.processed')
  onDiscordEventProcessed(data: { eventType: string; success: boolean; duration: number }) {
    this.systemMetrics.discord.eventsProcessed++

    if (!data.success) {
      this.systemMetrics.discord.errors++
    }

    this.systemMetrics.discord.totalResponseTime += data.duration
  }

  /**
   * HTTP リクエスト監視
   */
  @OnEvent('http.request.start')
  onHttpRequestStart(data: { method: string; url: string; userAgent?: string }) {
    return this.discordPerformanceMonitor.startApiCall(`http:${data.method}:${data.url}`, data.method)
  }

  @OnEvent('http.request.complete')
  onHttpRequestComplete(data: { method: string; url: string; statusCode: number; duration: number; success: boolean }) {
    this.systemMetrics.http.requests++
    this.systemMetrics.http.totalResponseTime += data.duration

    if (!data.success || data.statusCode >= 400) {
      this.systemMetrics.http.errors++
    }

    if (data.duration > this.alertConfig.httpResponseTime) {
      this.triggerAlert({
        type: 'slow-http',
        severity: 'warning',
        message: `HTTP ${data.method} ${data.url} took ${data.duration}ms`,
        data: { method: data.method, url: data.url, duration: data.duration }
      })
    }
  }

  /**
   * データベース操作監視
   */
  @OnEvent('database.query.complete')
  onDatabaseQueryComplete(data: {
    operation: string
    collection?: string
    duration: number
    success: boolean
    error?: string
  }) {
    this.systemMetrics.database.queries++
    this.systemMetrics.database.totalResponseTime += data.duration

    if (!data.success) {
      this.systemMetrics.database.errors++
      this.logger.warn(`Database operation failed: ${data.operation} - ${data.error}`)
    }
  }

  /**
   * 定期的なヘルスチェック
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthCheck() {
    const now = Date.now()
    const timeSinceLastCheck = now - this.lastHealthCheck
    this.lastHealthCheck = now

    // Discord監視サービスのヘルス状態
    const discordHealth = this.discordPerformanceMonitor.getHealthStatus()

    // メモリ使用量チェック
    const memUsage = process.memoryUsage()
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)

    if (heapUsedMB > this.alertConfig.memoryUsageThreshold) {
      this.triggerAlert({
        type: 'high-memory-usage',
        severity: 'warning',
        message: `High memory usage: ${heapUsedMB}MB`,
        data: { heapUsedMB, rss: Math.round(memUsage.rss / 1024 / 1024) }
      })
    }

    // エラー率チェック
    const totalOperations =
      this.systemMetrics.discord.commandsExecuted +
      this.systemMetrics.http.requests +
      this.systemMetrics.database.queries

    const totalErrors =
      this.systemMetrics.discord.errors + this.systemMetrics.http.errors + this.systemMetrics.database.errors

    const errorRate = totalOperations > 0 ? totalErrors / totalOperations : 0

    if (errorRate > this.alertConfig.errorRateThreshold) {
      this.triggerAlert({
        type: 'high-error-rate',
        severity: 'critical',
        message: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
        data: { errorRate, totalErrors, totalOperations }
      })
    }

    // ヘルス状態発行
    this.eventEmitter.emit('system.health.status', {
      timestamp: now,
      status: discordHealth.status,
      metrics: {
        memory: { heapUsedMB, rssMB: Math.round(memUsage.rss / 1024 / 1024) },
        errorRate,
        totalOperations,
        totalErrors,
        discord: this.systemMetrics.discord,
        http: this.systemMetrics.http,
        database: this.systemMetrics.database
      },
      discord: discordHealth,
      uptime: now - this.systemMetrics.startTime
    })

    this.logger.debug(
      `Health check completed - Status: ${discordHealth.status}, Error Rate: ${(errorRate * 100).toFixed(2)}%`
    )
  }

  /**
   * 1時間ごとのメトリクス集計
   */
  @Cron(CronExpression.EVERY_HOUR)
  aggregateHourlyMetrics() {
    const hour = new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH

    const hourlyData = {
      timestamp: Date.now(),
      discord: { ...this.systemMetrics.discord },
      http: { ...this.systemMetrics.http },
      database: { ...this.systemMetrics.database },
      performance: this.discordPerformanceMonitor.getStats()
    }

    this.trends.hourlyStats.set(hour, hourlyData)

    // 24時間より古いデータを削除
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    for (const [key, data] of this.trends.hourlyStats.entries()) {
      if (data.timestamp < cutoff) {
        this.trends.hourlyStats.delete(key)
      }
    }

    this.logger.log(`Hourly metrics aggregated for ${hour}`)

    // パフォーマンスレポートの定期メンテナンス
    this.discordPerformanceMonitor.performMaintenance()
  }

  /**
   * 日次統計集計
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  aggregateDailyMetrics() {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    // 過去24時間のデータから日次統計を計算
    const dailyData = {
      timestamp: Date.now(),
      totalCommands: this.systemMetrics.discord.commandsExecuted,
      totalEvents: this.systemMetrics.discord.eventsProcessed,
      totalHttpRequests: this.systemMetrics.http.requests,
      totalDbQueries: this.systemMetrics.database.queries,
      totalErrors:
        this.systemMetrics.discord.errors + this.systemMetrics.http.errors + this.systemMetrics.database.errors,
      avgDiscordResponseTime:
        this.systemMetrics.discord.commandsExecuted > 0
          ? this.systemMetrics.discord.totalResponseTime / this.systemMetrics.discord.commandsExecuted
          : 0,
      avgHttpResponseTime:
        this.systemMetrics.http.requests > 0
          ? this.systemMetrics.http.totalResponseTime / this.systemMetrics.http.requests
          : 0,
      avgDbResponseTime:
        this.systemMetrics.database.queries > 0
          ? this.systemMetrics.database.totalResponseTime / this.systemMetrics.database.queries
          : 0
    }

    this.trends.dailyStats.set(today, dailyData)

    // 30日より古いデータを削除
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    for (const [key, data] of this.trends.dailyStats.entries()) {
      if (data.timestamp < cutoff) {
        this.trends.dailyStats.delete(key)
      }
    }

    this.logger.log(`Daily metrics aggregated for ${today}`)

    // 日次でメトリクスをリセット
    this.resetDailyMetrics()
  }

  /**
   * アラート発行
   */
  private triggerAlert(alert: {
    type: string
    severity: 'info' | 'warning' | 'critical'
    message: string
    data?: any
  }) {
    const alertData = {
      ...alert,
      timestamp: Date.now(),
      source: 'performance-metrics-integration'
    }

    // ログ出力
    const logLevel = alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warn' : 'log'
    this.logger[logLevel](`[ALERT:${alert.type.toUpperCase()}] ${alert.message}`)

    // イベント発行
    this.eventEmitter.emit('system.alert', alertData)
    this.eventEmitter.emit(`system.alert.${alert.type}`, alertData)

    // 重要度に応じた追加処理
    if (alert.severity === 'critical') {
      this.eventEmitter.emit('system.alert.critical', alertData)
    }
  }

  /**
   * 日次メトリクスリセット
   */
  private resetDailyMetrics() {
    // 累積統計のみリセットし、傾向分析用のデータは保持
    this.systemMetrics.discord.commandsExecuted = 0
    this.systemMetrics.discord.eventsProcessed = 0
    this.systemMetrics.discord.embedsCreated = 0
    this.systemMetrics.discord.messagesSent = 0
    this.systemMetrics.discord.channelsCreated = 0
    this.systemMetrics.discord.errors = 0
    this.systemMetrics.discord.totalResponseTime = 0

    this.systemMetrics.http.requests = 0
    this.systemMetrics.http.responses = 0
    this.systemMetrics.http.errors = 0
    this.systemMetrics.http.totalResponseTime = 0

    this.systemMetrics.database.queries = 0
    this.systemMetrics.database.errors = 0
    this.systemMetrics.database.totalResponseTime = 0

    this.consecutiveErrors = 0
  }

  /**
   * 定期監視開始
   */
  private startPeriodicMonitoring() {
    // メモリ使用量の定期記録（5分ごと）
    setInterval(
      () => {
        this.discordPerformanceMonitor.recordMemoryUsage()
      },
      5 * 60 * 1000
    )

    this.logger.log('Periodic monitoring started')
  }

  /**
   * パフォーマンス統計取得
   */
  getPerformanceStats() {
    const discordStats = this.discordPerformanceMonitor.getStats()

    return {
      system: {
        discord: this.systemMetrics.discord,
        http: this.systemMetrics.http,
        database: this.systemMetrics.database
      },
      discord: discordStats,
      trends: {
        hourly: Array.from(this.trends.hourlyStats.entries()).slice(-24),
        daily: Array.from(this.trends.dailyStats.entries()).slice(-30)
      },
      health: this.discordPerformanceMonitor.getHealthStatus(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  }

  /**
   * メトリクス手動リセット
   */
  resetAllMetrics() {
    this.resetDailyMetrics()
    this.discordPerformanceMonitor.reset()
    this.trends.hourlyStats.clear()
    this.trends.dailyStats.clear()

    this.logger.log('All performance metrics have been reset')
  }
}
