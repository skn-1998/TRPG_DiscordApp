import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { ConfigService } from '@nestjs/config'

interface AlertRule {
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

interface AlertAction {
  type: 'log' | 'email' | 'slack' | 'webhook'
  config: any
}

interface ActiveAlert {
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
  count: number // 同じアラートの発生回数
  lastTriggered: number
}

/**
 * アラートシステムサービス
 * パフォーマンス監視とシステムアラートの管理
 */
@Injectable()
export class AlertSystemService implements OnModuleInit {
  private readonly logger = new Logger(AlertSystemService.name)

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

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.initializeDefaultRules()
    this.logger.log('Alert System Service initialized with default rules')
  }

  /**
   * デフォルトアラートルールを初期化
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
        cooldown: 300000, // 5分
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
        cooldown: 600000, // 10分
        actions: [{ type: 'log', config: { level: 'warn' } }]
      },
      {
        id: 'slow-discord-response',
        name: 'Discord応答遅延アラート',
        description: 'Discord操作の平均応答時間が3秒を超えた場合',
        eventPattern: 'system.health.status',
        condition: (data) => data.discord?.metrics?.avgResponseTime > 3000,
        severity: 'warning',
        enabled: true,
        cooldown: 180000, // 3分
        actions: [{ type: 'log', config: { level: 'warn' } }]
      },
      {
        id: 'discord-rate-limited',
        name: 'Discord レート制限アラート',
        description: 'Discord APIがレート制限に達した場合',
        eventPattern: 'discord.performance.alert',
        condition: (data) => data.type === 'rate-limited',
        severity: 'critical',
        enabled: true,
        cooldown: 60000, // 1分
        actions: [{ type: 'log', config: { level: 'error' } }]
      },
      {
        id: 'consecutive-errors',
        name: '連続エラーアラート',
        description: '連続してエラーが10回以上発生した場合',
        eventPattern: 'system.alert.consecutive-errors',
        condition: (data) => data.data?.consecutiveErrors >= 10,
        severity: 'critical',
        enabled: true,
        cooldown: 300000, // 5分
        actions: [{ type: 'log', config: { level: 'error' } }]
      },
      {
        id: 'command-failure-spike',
        name: 'コマンド失敗急増アラート',
        description: 'Discord コマンドの失敗が急激に増加した場合',
        eventPattern: 'discord.command.complete',
        condition: (data) => !data.success && this.isCommandFailureSpike(),
        severity: 'warning',
        enabled: true,
        cooldown: 300000, // 5分
        actions: [{ type: 'log', config: { level: 'warn' } }]
      },
      {
        id: 'system-health-degraded',
        name: 'システム健全性悪化アラート',
        description: 'システム全体の健全性が悪化した場合',
        eventPattern: 'system.health.status',
        condition: (data) => data.status === 'critical',
        severity: 'critical',
        enabled: true,
        cooldown: 180000, // 3分
        actions: [{ type: 'log', config: { level: 'error' } }]
      }
    ]

    // ルールを登録
    defaultRules.forEach((rule) => {
      this.alertRules.set(rule.id, rule)
      this.statistics.alertsByRule.set(rule.id, 0)
    })

    // 重要度別統計初期化
    this.statistics.alertsBySeverity.set('info', 0)
    this.statistics.alertsBySeverity.set('warning', 0)
    this.statistics.alertsBySeverity.set('critical', 0)
  }

  /**
   * システムアラートイベントを監視
   */
  @OnEvent('system.alert')
  async handleSystemAlert(alertData: any) {
    await this.processAlert('system.alert', alertData)
  }

  @OnEvent('system.alert.*')
  async handleSpecificAlert(alertData: any) {
    await this.processAlert('system.alert.*', alertData)
  }

  @OnEvent('system.health.status')
  async handleHealthStatus(healthData: any) {
    await this.processAlert('system.health.status', healthData)
  }

  @OnEvent('discord.performance.alert')
  async handleDiscordPerformanceAlert(alertData: any) {
    await this.processAlert('discord.performance.alert', alertData)
  }

  @OnEvent('discord.command.complete')
  async handleDiscordCommandComplete(commandData: any) {
    await this.processAlert('discord.command.complete', commandData)
  }

  /**
   * アラート処理メイン関数
   */
  private async processAlert(eventPattern: string, data: any) {
    const now = Date.now()

    // 該当するルールを検索
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled || rule.eventPattern !== eventPattern) {
        continue
      }

      // クールダウン中かチェック
      const lastTriggered = this.cooldowns.get(ruleId) || 0
      if (now - lastTriggered < rule.cooldown) {
        continue
      }

      // 条件チェック
      try {
        if (rule.condition(data)) {
          await this.triggerAlert(rule, data)
          this.cooldowns.set(ruleId, now)
        }
      } catch (error) {
        this.logger.error(`Alert rule condition check failed for ${ruleId}:`, error)
      }
    }
  }

  /**
   * アラートを発火
   */
  private async triggerAlert(rule: AlertRule, data: any) {
    const now = Date.now()
    const alertId = `${rule.id}-${now}`

    // 既存のアクティブアラートがあるかチェック
    const existingAlert = Array.from(this.activeAlerts.values()).find(
      (alert) => alert.ruleId === rule.id && !alert.resolvedAt
    )

    if (existingAlert) {
      // 既存アラートの回数を増加
      existingAlert.count++
      existingAlert.lastTriggered = now

      this.logger.warn(`Alert repeated: ${rule.name} (count: ${existingAlert.count})`)
    } else {
      // 新しいアラートを作成
      const newAlert: ActiveAlert = {
        id: alertId,
        ruleId: rule.id,
        severity: rule.severity,
        message: this.formatAlertMessage(rule, data),
        data,
        triggeredAt: now,
        acknowledged: false,
        count: 1,
        lastTriggered: now
      }

      this.activeAlerts.set(alertId, newAlert)
      this.logger.error(`🚨 Alert triggered: ${rule.name} - ${newAlert.message}`)
    }

    // 統計更新
    this.statistics.totalAlerts++
    this.statistics.alertsByRule.set(rule.id, (this.statistics.alertsByRule.get(rule.id) || 0) + 1)
    this.statistics.alertsBySeverity.set(rule.severity, (this.statistics.alertsBySeverity.get(rule.severity) || 0) + 1)
    this.statistics.lastAlertTime = now

    // アクションを実行
    for (const action of rule.actions) {
      await this.executeAlertAction(action, rule, data)
    }
  }

  /**
   * アラートメッセージをフォーマット
   */
  private formatAlertMessage(rule: AlertRule, data: any): string {
    let message = rule.description

    // データに基づいてメッセージをカスタマイズ
    if (rule.id === 'high-error-rate' && data.metrics?.errorRate) {
      message += ` (現在のエラー率: ${(data.metrics.errorRate * 100).toFixed(2)}%)`
    } else if (rule.id === 'high-memory-usage' && data.metrics?.memory?.heapUsedMB) {
      message += ` (現在のメモリ使用量: ${data.metrics.memory.heapUsedMB}MB)`
    } else if (rule.id === 'slow-discord-response' && data.discord?.metrics?.avgResponseTime) {
      message += ` (平均応答時間: ${Math.round(data.discord.metrics.avgResponseTime)}ms)`
    }

    return message
  }

  /**
   * アラートアクションを実行
   */
  private async executeAlertAction(action: AlertAction, rule: AlertRule, data: any) {
    try {
      switch (action.type) {
        case 'log':
          const level = action.config?.level || 'info'
          const logMessage = `[ALERT:${rule.severity.toUpperCase()}] ${rule.name}: ${rule.description}`

          switch (level) {
            case 'error':
              this.logger.error(logMessage)
              break
            case 'warn':
              this.logger.warn(logMessage)
              break
            case 'debug':
              this.logger.debug(logMessage)
              break
            default:
              this.logger.log(logMessage)
              break
          }
          break

        case 'email':
          // メール送信実装（将来）
          this.logger.debug('Email alert action not implemented yet')
          break

        case 'slack':
          // Slack通知実装（将来）
          this.logger.debug('Slack alert action not implemented yet')
          break

        case 'webhook':
          // Webhook送信実装（将来）
          this.logger.debug('Webhook alert action not implemented yet')
          break
      }
    } catch (error) {
      this.logger.error(`Failed to execute alert action ${action.type}:`, error)
    }
  }

  /**
   * コマンド失敗の急増を判定
   */
  private isCommandFailureSpike(): boolean {
    // 簡易実装：過去5分間の失敗率が高い場合
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const recentFailures = Array.from(this.activeAlerts.values()).filter(
      (alert) => alert.ruleId === 'command-failure-spike' && alert.triggeredAt > fiveMinutesAgo
    ).length

    return recentFailures > 5
  }

  /**
   * アクティブアラート一覧を取得
   */
  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values())
      .filter((alert) => !alert.resolvedAt)
      .sort((a, b) => b.lastTriggered - a.lastTriggered)
  }

  /**
   * アラートを確認済みにする
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (!alert || alert.acknowledged) {
      return false
    }

    alert.acknowledged = true
    alert.acknowledgedAt = Date.now()
    alert.acknowledgedBy = acknowledgedBy

    this.logger.log(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`)
    return true
  }

  /**
   * アラートを解決済みにする
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (!alert || alert.resolvedAt) {
      return false
    }

    alert.resolvedAt = Date.now()
    this.logger.log(`Alert resolved: ${alertId}`)
    return true
  }

  /**
   * アラート統計を取得
   */
  getAlertStatistics(): {
    total: number
    active: number
    byRule: Array<{ ruleId: string; count: number }>
    bySeverity: Array<{ severity: string; count: number }>
    lastAlertTime: number
  } {
    const active = this.getActiveAlerts().length

    return {
      total: this.statistics.totalAlerts,
      active,
      byRule: Array.from(this.statistics.alertsByRule.entries())
        .map(([ruleId, count]) => ({ ruleId, count }))
        .sort((a, b) => b.count - a.count),
      bySeverity: Array.from(this.statistics.alertsBySeverity.entries()).map(([severity, count]) => ({
        severity,
        count
      })),
      lastAlertTime: this.statistics.lastAlertTime
    }
  }

  /**
   * アラートルール一覧を取得
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
  }

  /**
   * アラートルールを追加/更新
   */
  setAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule)

    if (!this.statistics.alertsByRule.has(rule.id)) {
      this.statistics.alertsByRule.set(rule.id, 0)
    }

    this.logger.log(`Alert rule updated: ${rule.id}`)
  }

  /**
   * アラートルールを無効化
   */
  disableAlertRule(ruleId: string): boolean {
    const rule = this.alertRules.get(ruleId)
    if (!rule) {
      return false
    }

    rule.enabled = false
    this.logger.log(`Alert rule disabled: ${ruleId}`)
    return true
  }

  /**
   * アラートルールを有効化
   */
  enableAlertRule(ruleId: string): boolean {
    const rule = this.alertRules.get(ruleId)
    if (!rule) {
      return false
    }

    rule.enabled = true
    this.logger.log(`Alert rule enabled: ${ruleId}`)
    return true
  }

  /**
   * 古いアラートをクリーンアップ
   */
  cleanupOldAlerts(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAge
    let cleanedCount = 0

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.activeAlerts.delete(alertId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} old resolved alerts`)
    }

    return cleanedCount
  }
}
