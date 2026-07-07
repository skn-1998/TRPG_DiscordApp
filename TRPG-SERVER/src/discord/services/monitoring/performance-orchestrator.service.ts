import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Interval } from '@nestjs/schedule'
import { MetricsCollectorService } from './metrics-collector.service'
import { AlertManagerService } from './alert-manager.service'
import { DiscordMonitorService } from './discord-monitor.service'

/**
 * パフォーマンス監視オーケストレーター
 * 監視サービス群を統合管理
 */

@Injectable()
export class PerformanceOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceOrchestratorService.name)

  constructor(
    private readonly metricsCollector: MetricsCollectorService,
    private readonly alertManager: AlertManagerService,
    private readonly discordMonitor: DiscordMonitorService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.logger.debug('Performance Orchestrator Service initialized')
  }

  async onModuleInit() {
    this.logger.log('Starting performance monitoring system')
    await this.initializeMonitoring()
  }

  /**
   * 監視システム初期化
   */
  private async initializeMonitoring() {
    // 初期ヘルスチェック
    const initialHealth = this.getSystemHealth()
    this.logger.log(`Initial system health: ${initialHealth.status}`)

    if (initialHealth.issues.length > 0) {
      this.logger.warn('Initial health issues detected:', initialHealth.issues)
    }

    // 監視開始イベント発行
    this.eventEmitter.emit('monitoring.system.started', {
      timestamp: Date.now(),
      health: initialHealth
    })
  }

  /**
   * 定期ヘルスチェック（5分間隔）
   */
  @Interval(300000) // 5分
  async performPeriodicHealthCheck() {
    try {
      const health = this.getSystemHealth()

      // ヘルスステータスをイベント発行
      this.eventEmitter.emit('system.health.status', {
        status: health.status,
        timestamp: Date.now(),
        metrics: health.metrics,
        issues: health.issues,
        discord: {
          metrics: this.discordMonitor.getStats().global
        }
      })

      // Critical状態の場合は特別ログ
      if (health.status === 'critical') {
        this.logger.error(`System health is CRITICAL: ${health.issues.join(', ')}`)
      } else if (health.status === 'warning') {
        this.logger.warn(`System health is WARNING: ${health.issues.join(', ')}`)
      }
    } catch (error) {
      this.logger.error('Failed to perform periodic health check:', error)
    }
  }

  /**
   * 定期メンテナンス（1時間間隔）
   */
  @Interval(3600000) // 1時間
  async performMaintenance() {
    try {
      this.logger.log('Performing monitoring system maintenance')

      // 各サービスのメンテナンス実行
      this.discordMonitor.performMaintenance()

      // 古いアラートクリーンアップ
      // AlertManagerServiceにクリーンアップ機能があれば呼び出し

      this.logger.log('Monitoring system maintenance completed')
    } catch (error) {
      this.logger.error('Failed to perform maintenance:', error)
    }
  }

  /**
   * システム全体のヘルス状態取得
   */
  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    metrics: {
      memory: any
      discord: any
      alerts: any
    }
  } {
    const issues: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    // Discord監視ヘルス
    const discordHealth = this.discordMonitor.getHealthStatus()
    if (discordHealth.status !== 'healthy') {
      issues.push(...discordHealth.issues)
      if (discordHealth.status === 'critical') {
        status = 'critical'
      } else if (status === 'healthy') {
        status = 'warning'
      }
    }

    // システムメトリクス取得
    const systemMetrics = this.metricsCollector.getSystemMetrics()

    // メモリ使用量チェック（800MB以上で警告）
    if (systemMetrics.memory.heapUsedMB > 800) {
      issues.push(`High memory usage: ${systemMetrics.memory.heapUsedMB}MB`)
      if (systemMetrics.memory.heapUsedMB > 1000) {
        status = 'critical'
      } else if (status === 'healthy') {
        status = 'warning'
      }
    }

    // アラート統計取得
    const alertStats = this.alertManager.getAlertStatistics()

    // アクティブアラート数チェック
    if (alertStats.activeAlertsCount > 5) {
      issues.push(`Too many active alerts: ${alertStats.activeAlertsCount}`)
      status = 'critical'
    } else if (alertStats.activeAlertsCount > 2 && status !== 'critical') {
      status = 'warning'
    }

    return {
      status,
      issues,
      metrics: {
        memory: systemMetrics.memory,
        discord: discordHealth.metrics,
        alerts: {
          active: alertStats.activeAlertsCount,
          total: alertStats.totalAlerts
        }
      }
    }
  }

  /**
   * パフォーマンス統計のサマリー取得
   */
  getPerformanceSummary() {
    const systemHealth = this.getSystemHealth()
    const discordStats = this.discordMonitor.getStats()
    const systemMetrics = this.metricsCollector.getSystemMetrics()
    const trends = this.metricsCollector.getTrends()

    return {
      system: {
        discord: systemMetrics.discord,
        http: systemMetrics.http,
        database: systemMetrics.database
      },
      discord: discordStats,
      trends: trends,
      health: {
        status: systemHealth.status,
        issues: systemHealth.issues,
        metrics: {
          avgResponseTime: discordStats.global.avgResponseTime,
          errorRate: discordStats.global.errorRate,
          activeAlerts: discordStats.alerts.length
        }
      },
      memory: {
        rss: systemMetrics.memory.rss * 1024 * 1024, // MBをバイトに変換
        heapTotal: systemMetrics.memory.heapTotal * 1024 * 1024,
        heapUsed: systemMetrics.memory.heapUsed * 1024 * 1024,
        external: systemMetrics.memory.external * 1024 * 1024,
        arrayBuffers: 0 // Node.js MemoryUsageに合わせる
      },
      uptime: Date.now() - systemMetrics.startTime
    }
  }

  /**
   * Discord API呼び出し監視開始
   */
  startDiscordApiMonitoring(endpoint: string, method: string = 'GET') {
    return this.discordMonitor.startApiCall(endpoint, method)
  }

  // C-3b（2026-07-07）: recordRateLimit / triggerAlert の委譲ラッパーは外部呼び出し元ゼロの dead のため撤去。
  // alertManager.triggerAlert 自体は @OnEvent 経由の内部利用で live のため alert-manager 側に残る。

  /**
   * システムリセット（デバッグ用）
   */
  resetMonitoring() {
    this.discordMonitor.reset()
    this.logger.log('Monitoring system has been reset')
  }
}
