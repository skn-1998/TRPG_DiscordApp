import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

/**
 * メトリクス収集サービス
 * 旧 performance-metrics-integration.service.ts のメトリクス収集部分を移行
 */

export interface SystemMetrics {
  startTime: number
  memory: {
    rss: number
    heapTotal: number
    heapUsed: number
    heapUsedMB: number
    external: number
  }
  discord: {
    commandsExecuted: number
    eventsProcessed: number
    embedsCreated: number
    messagesSent: number
    channelsCreated: number
    errors: number
    totalResponseTime: number
  }
  http: {
    requests: number
    responses: number
    errors: number
    totalResponseTime: number
  }
  database: {
    queries: number
    errors: number
    totalResponseTime: number
  }
}

@Injectable()
export class MetricsCollectorService implements OnModuleInit {
  private readonly logger = new Logger(MetricsCollectorService.name)

  // システム全体のメトリクス
  private readonly systemMetrics: SystemMetrics = {
    startTime: Date.now(),
    memory: {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      heapUsedMB: 0,
      external: 0
    },
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

  // パフォーマンス傾向データ
  private readonly trends = {
    hourlyStats: new Map<string, any>(),
    dailyStats: new Map<string, any>()
  }

  constructor() {
    this.logger.debug('Metrics Collector Service initialized')
  }

  async onModuleInit() {
    this.logger.log('Metrics collection started')
  }

  // C-3b′（2026-07-07）: @OnEvent 購読 5 本（discord.command.start / discord.command.complete /
  // discord.event.processed / http.request.complete / database.query.complete）は emit 元ゼロの
  // dead 配線のため撤去。systemMetrics の discord/http/database セクションは getSystemMetrics の
  // 出力形状維持のため残す（実行時は従来から常にゼロ＝挙動不変）。EventEmitter2 注入も未使用化により削除。

  /**
   * 1時間ごとのメトリクス集計
   */
  aggregateHourlyMetrics() {
    const hour = new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH

    const hourlyData = {
      timestamp: Date.now(),
      discord: { ...this.systemMetrics.discord },
      http: { ...this.systemMetrics.http },
      database: { ...this.systemMetrics.database }
    }

    this.trends.hourlyStats.set(hour, hourlyData)

    // 24時間より古いデータを削除
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    for (const [key, data] of this.trends.hourlyStats.entries()) {
      if (data.timestamp < cutoff) {
        this.trends.hourlyStats.delete(key)
      }
    }

    this.logger.debug(`Hourly metrics aggregated for ${hour}`)
  }

  /**
   * 日次統計集計
   */
  aggregateDailyMetrics() {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

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
    this.resetDailyMetrics()
  }

  /**
   * 現在のメトリクス取得
   */
  getSystemMetrics(): SystemMetrics {
    // メモリ使用量を現在の値で更新
    const memUsage = process.memoryUsage()
    this.systemMetrics.memory = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024), // 互換性のため
      external: Math.round(memUsage.external / 1024 / 1024)
    }

    return { ...this.systemMetrics }
  }

  /**
   * トレンドデータ取得
   */
  getTrends() {
    return {
      hourly: Array.from(this.trends.hourlyStats.entries()).slice(-24),
      daily: Array.from(this.trends.dailyStats.entries()).slice(-30)
    }
  }

  /**
   * エラー率計算
   */
  getErrorRate(): number {
    const totalOperations =
      this.systemMetrics.discord.commandsExecuted +
      this.systemMetrics.http.requests +
      this.systemMetrics.database.queries

    const totalErrors =
      this.systemMetrics.discord.errors + this.systemMetrics.http.errors + this.systemMetrics.database.errors

    return totalOperations > 0 ? totalErrors / totalOperations : 0
  }

  /**
   * メモリ使用量取得
   */
  getMemoryUsage() {
    const memUsage = process.memoryUsage()
    return {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024)
    }
  }

  /**
   * 日次メトリクスリセット
   */
  private resetDailyMetrics() {
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
  }

  /**
   * 全メトリクスリセット
   */
  resetAllMetrics() {
    this.resetDailyMetrics()
    this.trends.hourlyStats.clear()
    this.trends.dailyStats.clear()
    this.logger.log('All metrics have been reset')
  }
}
