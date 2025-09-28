import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter'
import { ConfigService } from '@nestjs/config'

/**
 * アラート管理サービス
 * 旧 alert-system.service.ts から移行
 */

export interface AlertRule {
  id: string
  name: string
  description: string
  eventPattern: string
  condition: (data: any) => boolean
  severity: 'info' | 'warning' | 'critical'
  enabled: boolean
  cooldown: number // ミリ秒
  actions: AlertAction[]
}

export interface AlertAction {
  type: 'log' | 'email' | 'slack' | 'webhook'
  config: any
}

export interface ActiveAlert {
  id: string
  ruleId: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  data: any
  triggeredAt: number
  acknowledged: boolean
  acknowledgedAt?: number
  acknowledgedBy?: string
  resolvedAt?: number
  count: number
  lastTriggered: number
}

@Injectable()
export class AlertManagerService implements OnModuleInit {
  private readonly logger = new Logger(AlertManagerService.name)

  // アラートルール
  private readonly alertRules: Map<string, AlertRule> = new Map()

  // アクティブアラート
  private readonly activeAlerts: Map<string, ActiveAlert> = new Map()

  // クールダウン管理
  private readonly cooldowns: Map<string, number> = new Map()

  // アラート統計
  private readonly statistics = {
    totalAlerts: 0,
    alertsByRule: new Map<string, number>(),
    alertsBySeverity: new Map<string, number>(),
    lastAlertTime: 0
  }

  // コマンド失敗履歴
  private commandFailureHistory: number[] = []

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.logger.debug('Alert Manager Service initialized')
  }

  async onModuleInit() {
    this.initializeDefaultRules()
    this.logger.log('Alert system initialized with default rules')
  }

  /**
   * デフォルトアラートルール初期化
   */
  private initializeDefaultRules() {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: '高エラー率アラート',
        description: 'エラー率が5%を超えた場合',
        eventPattern: 'system.health.status',
        condition: (data) => data.metrics?.errorRate > 0.05,
        severity: 'critical',
        enabled: true,
        cooldown: 300000,
        actions: [{ type: 'log', config: { level: 'error' } }]
      },
      {
        id: 'high-memory-usage',
        name: '高メモリ使用量アラート',
        description: 'メモリ使用量が800MBを超えた場合',
        eventPattern: 'system.health.status',
        condition: (data) => data.metrics?.memory?.heapUsedMB > 800,
        severity: 'warning',
        enabled: true,
        cooldown: 600000,
        actions: [{ type: 'log', config: { level: 'warn' } }]
      },
      {
        id: 'consecutive-errors',
        name: '連続エラーアラート',
        description: '連続してエラーが10回以上発生した場合',
        eventPattern: 'system.alert.consecutive-errors',
        condition: (data) => data.data?.consecutiveErrors >= 10,
        severity: 'critical',
        enabled: true,
        cooldown: 300000,
        actions: [{ type: 'log', config: { level: 'error' } }]
      }
    ]

    defaultRules.forEach((rule) => {
      this.alertRules.set(rule.id, rule)
    })

    this.logger.debug(`Initialized ${defaultRules.length} default alert rules`)
  }

  /**
   * システムアラートハンドリング
   */
  @OnEvent('system.alert')
  async handleSystemAlert(data: any) {
    await this.triggerAlert({
      type: data.type || 'system',
      severity: data.severity || 'info',
      message: data.message || 'System alert triggered',
      data: data.data || {}
    })
  }

  /**
   * システムヘルス監視
   */
  @OnEvent('system.health.status')
  async handleHealthStatus(data: any) {
    for (const rule of this.alertRules.values()) {
      if (rule.enabled && rule.eventPattern === 'system.health.status') {
        try {
          if (rule.condition(data)) {
            await this.triggerAlert({
              type: rule.id,
              severity: rule.severity,
              message: `${rule.name}: ${rule.description}`,
              data
            })
          }
        } catch (error) {
          this.logger.error(`Error evaluating alert rule ${rule.id}:`, error)
        }
      }
    }
  }

  /**
   * アラート発行
   */
  async triggerAlert(alert: { type: string; severity: 'info' | 'warning' | 'critical'; message: string; data?: any }) {
    const now = Date.now()
    const alertId = `${alert.type}-${now}`

    // クールダウンチェック
    const rule = this.alertRules.get(alert.type)
    if (rule && this.isInCooldown(rule.id)) {
      return
    }

    // アクティブアラートに追加
    const activeAlert: ActiveAlert = {
      id: alertId,
      ruleId: alert.type,
      severity: alert.severity,
      message: alert.message,
      data: alert.data || {},
      triggeredAt: now,
      acknowledged: false,
      count: 1,
      lastTriggered: now
    }

    this.activeAlerts.set(alertId, activeAlert)

    // 統計更新
    this.statistics.totalAlerts++
    this.statistics.alertsByRule.set(alert.type, (this.statistics.alertsByRule.get(alert.type) || 0) + 1)
    this.statistics.alertsBySeverity.set(
      alert.severity,
      (this.statistics.alertsBySeverity.get(alert.severity) || 0) + 1
    )
    this.statistics.lastAlertTime = now

    // クールダウン設定
    if (rule) {
      this.cooldowns.set(rule.id, now + rule.cooldown)
    }

    // ログ出力
    const logLevel = alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warn' : 'log'
    this.logger[logLevel](`[ALERT:${alert.type.toUpperCase()}] ${alert.message}`)

    // イベント発行
    this.eventEmitter.emit(`system.alert.${alert.type}`, activeAlert)
    if (alert.severity === 'critical') {
      this.eventEmitter.emit('system.alert.critical', activeAlert)
    }
  }

  /**
   * クールダウンチェック
   */
  private isInCooldown(ruleId: string): boolean {
    const cooldownEnd = this.cooldowns.get(ruleId)
    if (!cooldownEnd) return false

    const now = Date.now()
    if (now >= cooldownEnd) {
      this.cooldowns.delete(ruleId)
      return false
    }

    return true
  }

  /**
   * アラート承認
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (!alert) return false

    alert.acknowledged = true
    alert.acknowledgedAt = Date.now()
    alert.acknowledgedBy = acknowledgedBy

    this.logger.log(`Alert ${alertId} acknowledged by ${acknowledgedBy}`)
    return true
  }

  /**
   * アクティブアラート取得
   */
  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values())
      .filter((alert) => !alert.resolvedAt)
      .sort((a, b) => b.triggeredAt - a.triggeredAt)
  }

  /**
   * アラート統計取得
   */
  getAlertStatistics() {
    return {
      ...this.statistics,
      activeAlertsCount: this.getActiveAlerts().length,
      alertsByRule: Object.fromEntries(this.statistics.alertsByRule),
      alertsBySeverity: Object.fromEntries(this.statistics.alertsBySeverity)
    }
  }

  /**
   * アラートルール管理
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule)
    this.logger.log(`Alert rule added: ${rule.id}`)
  }

  removeAlertRule(ruleId: string): boolean {
    const success = this.alertRules.delete(ruleId)
    if (success) {
      this.logger.log(`Alert rule removed: ${ruleId}`)
    }
    return success
  }

  getAllAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
  }
}
