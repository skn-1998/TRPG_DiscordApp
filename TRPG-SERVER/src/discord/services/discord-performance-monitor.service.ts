import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

/**
 * Discord パフォーマンス監視サービス
 * API応答時間、エラー率、レート制限情報を監視
 */
@Injectable()
export class DiscordPerformanceMonitorService {
  private readonly logger = new Logger(DiscordPerformanceMonitorService.name)

  // メトリクス収集
  private readonly metrics = {
    apiCalls: new Map<
      string,
      {
        count: number
        totalTime: number
        errors: number
        lastCall: number
        avgResponseTime: number
        errorRate: number
      }
    >(),

    globalStats: {
      totalCalls: 0,
      totalErrors: 0,
      totalTime: 0,
      startTime: Date.now()
    }
  }

  // パフォーマンス閾値
  private readonly thresholds = {
    slowApiCall: 1000, // 1秒
    highErrorRate: 0.05, // 5%
    rateLimit429Rate: 0.01 // 1%
  }

  // アラート状態
  private readonly alerts = new Set<string>()

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * API呼び出し開始
   */
  startApiCall(
    endpoint: string,
    method: string = 'GET'
  ): {
    end: (success: boolean, statusCode?: number) => void
  } {
    const startTime = Date.now()
    const key = `${method}:${endpoint}`

    return {
      end: (success: boolean, statusCode?: number) => {
        this.endApiCall(key, startTime, success, statusCode)
      }
    }
  }

  /**
   * API呼び出し終了
   */
  private endApiCall(key: string, startTime: number, success: boolean, statusCode?: number): void {
    const duration = Date.now() - startTime

    // メトリクス更新
    if (!this.metrics.apiCalls.has(key)) {
      this.metrics.apiCalls.set(key, {
        count: 0,
        totalTime: 0,
        errors: 0,
        lastCall: 0,
        avgResponseTime: 0,
        errorRate: 0
      })
    }

    const metric = this.metrics.apiCalls.get(key)!
    metric.count++
    metric.totalTime += duration
    metric.lastCall = Date.now()

    if (!success) {
      metric.errors++
    }

    // 統計値計算
    metric.avgResponseTime = metric.totalTime / metric.count
    metric.errorRate = metric.errors / metric.count

    // グローバル統計更新
    this.metrics.globalStats.totalCalls++
    this.metrics.globalStats.totalTime += duration

    if (!success) {
      this.metrics.globalStats.totalErrors++
    }

    // パフォーマンス閾値チェック
    this.checkThresholds(key, metric, duration, statusCode)

    // デバッグログ（遅い呼び出しのみ）
    if (duration > this.thresholds.slowApiCall) {
      this.logger.warn(`Slow API call: ${key} took ${duration}ms`)
    }
  }

  /**
   * レート制限情報記録
   */
  recordRateLimit(endpoint: string, remaining: number, limit: number, resetTime: number): void {
    const utilizationRate = 1 - remaining / limit

    if (utilizationRate > 0.8) {
      // 80%以上使用時
      this.logger.warn(`High rate limit utilization: ${endpoint} - ${remaining}/${limit} remaining`)
    }

    // レート制限統計をイベント発行
    this.eventEmitter.emit('discord.rate-limit.status', {
      endpoint,
      remaining,
      limit,
      utilizationRate,
      resetTime,
      timestamp: Date.now()
    })
  }

  /**
   * メモリ使用量監視
   */
  recordMemoryUsage(): void {
    const memUsage = process.memoryUsage()

    const stats = {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      timestamp: Date.now()
    }

    // メモリ使用量が高い場合は警告
    if (stats.heapUsed > 500) {
      // 500MB
      this.logger.warn(`High memory usage: ${stats.heapUsed}MB heap used`)
    }

    this.eventEmitter.emit('discord.memory.status', stats)
  }

  /**
   * 閾値チェックとアラート生成
   */
  private checkThresholds(key: string, metric: any, duration: number, statusCode?: number): void {
    const alertKey = `${key}-performance`
    const errorAlertKey = `${key}-errors`

    // 応答時間アラート
    if (duration > this.thresholds.slowApiCall && !this.alerts.has(alertKey)) {
      this.alerts.add(alertKey)
      this.logger.error(`Performance alert: ${key} average response time is ${metric.avgResponseTime}ms`)

      this.eventEmitter.emit('discord.performance.alert', {
        type: 'slow-response',
        endpoint: key,
        avgResponseTime: metric.avgResponseTime,
        threshold: this.thresholds.slowApiCall,
        timestamp: Date.now()
      })

      // 1分後にアラートリセット
      setTimeout(() => this.alerts.delete(alertKey), 60000)
    }

    // エラー率アラート
    if (metric.errorRate > this.thresholds.highErrorRate && !this.alerts.has(errorAlertKey)) {
      this.alerts.add(errorAlertKey)
      this.logger.error(`Error rate alert: ${key} error rate is ${(metric.errorRate * 100).toFixed(2)}%`)

      this.eventEmitter.emit('discord.performance.alert', {
        type: 'high-error-rate',
        endpoint: key,
        errorRate: metric.errorRate,
        threshold: this.thresholds.highErrorRate,
        timestamp: Date.now()
      })

      setTimeout(() => this.alerts.delete(errorAlertKey), 300000) // 5分後リセット
    }

    // 429 (Rate Limited) 特別処理
    if (statusCode === 429) {
      this.logger.error(`Rate limit hit: ${key}`)

      this.eventEmitter.emit('discord.performance.alert', {
        type: 'rate-limited',
        endpoint: key,
        timestamp: Date.now()
      })
    }
  }

  /**
   * パフォーマンス統計取得
   */
  getStats(): {
    global: {
      uptime: number
      totalCalls: number
      totalErrors: number
      avgResponseTime: number
      errorRate: number
    }
    endpoints: Array<{
      endpoint: string
      count: number
      avgResponseTime: number
      errorRate: number
      lastCall: number
    }>
    alerts: string[]
  } {
    const uptime = Date.now() - this.metrics.globalStats.startTime
    const globalAvgTime =
      this.metrics.globalStats.totalCalls > 0
        ? this.metrics.globalStats.totalTime / this.metrics.globalStats.totalCalls
        : 0
    const globalErrorRate =
      this.metrics.globalStats.totalCalls > 0
        ? this.metrics.globalStats.totalErrors / this.metrics.globalStats.totalCalls
        : 0

    const endpoints = Array.from(this.metrics.apiCalls.entries())
      .map(([endpoint, metric]) => ({
        endpoint,
        count: metric.count,
        avgResponseTime: metric.avgResponseTime,
        errorRate: metric.errorRate,
        lastCall: metric.lastCall
      }))
      .sort((a, b) => b.count - a.count) // 呼び出し回数順

    return {
      global: {
        uptime,
        totalCalls: this.metrics.globalStats.totalCalls,
        totalErrors: this.metrics.globalStats.totalErrors,
        avgResponseTime: globalAvgTime,
        errorRate: globalErrorRate
      },
      endpoints,
      alerts: Array.from(this.alerts)
    }
  }

  /**
   * 統計リセット
   */
  reset(): void {
    this.metrics.apiCalls.clear()
    this.metrics.globalStats = {
      totalCalls: 0,
      totalErrors: 0,
      totalTime: 0,
      startTime: Date.now()
    }
    this.alerts.clear()

    this.logger.log('Performance metrics have been reset')
  }

  /**
   * ヘルスチェック
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    metrics: {
      avgResponseTime: number
      errorRate: number
      activeAlerts: number
    }
  } {
    const stats = this.getStats()
    const issues: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    // 応答時間チェック
    if (stats.global.avgResponseTime > this.thresholds.slowApiCall) {
      issues.push(`Average response time is high: ${stats.global.avgResponseTime}ms`)
      status = 'warning'
    }

    // エラー率チェック
    if (stats.global.errorRate > this.thresholds.highErrorRate) {
      issues.push(`Error rate is high: ${(stats.global.errorRate * 100).toFixed(2)}%`)
      status = status === 'healthy' ? 'warning' : 'critical'
    }

    // アクティブアラートチェック
    if (stats.alerts.length > 3) {
      issues.push(`Too many active alerts: ${stats.alerts.length}`)
      status = 'critical'
    }

    return {
      status,
      issues,
      metrics: {
        avgResponseTime: stats.global.avgResponseTime,
        errorRate: stats.global.errorRate,
        activeAlerts: stats.alerts.length
      }
    }
  }

  /**
   * 定期的なクリーンアップとレポート
   */
  performMaintenance(): void {
    const now = Date.now()
    const oldCallThreshold = now - 3600000 // 1時間前

    // 古いメトリクスを削除
    for (const [key, metric] of this.metrics.apiCalls.entries()) {
      if (metric.lastCall < oldCallThreshold) {
        this.metrics.apiCalls.delete(key)
      }
    }

    // メモリ使用量記録
    this.recordMemoryUsage()

    // パフォーマンスレポート発行
    const stats = this.getStats()
    if (stats.global.totalCalls > 0) {
      this.logger.log(
        `Performance Report - Calls: ${stats.global.totalCalls}, ` +
          `Avg: ${Math.round(stats.global.avgResponseTime)}ms, ` +
          `Errors: ${(stats.global.errorRate * 100).toFixed(2)}%`
      )
    }
  }
}
