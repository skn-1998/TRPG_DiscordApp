import { Injectable, Logger } from '@nestjs/common'
import { Client } from 'discord.js'
import { AppConfigService } from '../config/config.service'
import { DiscordClientService } from './services/discord-client.service'
import { CommandManagerService } from './services/command-manager.service'
import { DiscordInteractionHandlerService } from './services/discord-interaction-handler.service'
import { DiscordGuildManagerService } from './services/discord-guild-manager.service'
import { DiscordChannelManagerService } from './services/discord-channel-manager.service'
import { PerformanceOrchestratorService } from './services/monitoring/performance-orchestrator.service'
import { CommandsService } from './commands/commands.service'

/**
 * Discord統合ファサードサービス
 *
 * features/アーキテクチャに準拠した薄いファサード
 * 各専門サービスへの委譲を行い、責務を明確に分離
 */
@Injectable()
export class DiscordFacadeService {
  private readonly logger = new Logger(DiscordFacadeService.name)
  private initialized = false
  private client: Client

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly commandsService: CommandsService,
    private readonly appConfigService: AppConfigService,
    private readonly commandManagerService: CommandManagerService,
    private readonly interactionHandler: DiscordInteractionHandlerService,
    private readonly guildManager: DiscordGuildManagerService,
    private readonly channelManager: DiscordChannelManagerService,
    private readonly performanceOrchestrator: PerformanceOrchestratorService
  ) {
    this.client = this.discordClientService.getClient()
  }

  /**
   * Discord サービス初期化
   * 各専門サービスを協調させて初期化を実行
   */
  async initializeDiscord(): Promise<void> {
    if (this.initialized) {
      return
    }

    const startTime = Date.now()
    this.logger.log('Discord初期化を開始します...')

    try {
      // パフォーマンス監視開始
      const initMetrics = this.performanceOrchestrator.startDiscordApiMonitoring('discord.initialize', 'INIT')

      // 注: 旧 typed イベント発行ヘルパクラスの client へのアタッチは E-4c で撤去
      //    （クラスは E-3a で空化済み・client['typedEventEmitter'] の読み取り箇所ゼロを確認）

      // 各サービスにクライアントを設定（並列処理）
      // loadClient は同期 void だが、初期化処理の塊として Promise.all 内にまとめている。
      // 構造を変えると初期化順序・並列性が変わり得るため現状維持し、await-thenable は意図的に許容する。
      // ※ ChannelCreate リスナー登録は characterEdit feature の
      //   CharacterEditChannelCreateListenerService（OnModuleInit）へ移管済み（§8）。
      await Promise.all([
        // eslint-disable-next-line @typescript-eslint/await-thenable -- loadClient は同期 void。Promise.all の塊として意図的に内包
        this.commandsService.loadClient(this.client),
        this.interactionHandler.initialize(this.client),
        this.guildManager.initialize(this.client),
        this.channelManager.initialize(this.client)
      ])

      // Discord Client初期化
      await this.discordClientService.initializeClient()

      this.initialized = true

      // パフォーマンス監視終了
      initMetrics.end(true)

      const duration = Date.now() - startTime
      this.logger.log(`Discord初期化が完了しました (${duration}ms)`)

      // 初期化完了メトリクス記録
      // メモリ使用量は定期的に自動記録される
    } catch (error) {
      this.logger.error('Discord初期化に失敗しました', error)
      throw error
    }
  }

  /**
   * チャンネルアクセス権限確認
   * GuildManagerサービスに委譲
   */
  async verifyChannelAccess(channelId: string, discordUserId: string): Promise<boolean> {
    const metrics = this.performanceOrchestrator.startDiscordApiMonitoring('discord.verifyChannelAccess', 'GET')
    try {
      const result = await this.guildManager.verifyChannelAccess(this.client, channelId, discordUserId)
      metrics.end(true)
      return result.hasAccess
    } catch (error) {
      metrics.end(false)
      throw error
    }
  }

  /**
   * ギルドアクセス権限確認
   * GuildManagerサービスに委譲
   */
  async verifyGuildAccess(guildId: string, discordUserId: string): Promise<boolean> {
    const metrics = this.performanceOrchestrator.startDiscordApiMonitoring('discord.verifyGuildAccess', 'GET')
    try {
      const result = await this.guildManager.verifyGuildAccess(this.client, guildId, discordUserId)
      metrics.end(true)
      return result.hasAccess
    } catch (error) {
      metrics.end(false)
      throw error
    }
  }

  /**
   * チャンネル情報取得
   * ChannelManagerサービスに委譲
   */
  async getChannelInfo(channelId: string): Promise<{
    id: string
    name: string
    type: string
    guild: { id: string; name: string }
  } | null> {
    const metrics = this.performanceOrchestrator.startDiscordApiMonitoring('discord.getChannelInfo', 'GET')
    try {
      const result = await this.channelManager.getChannelInfo(this.client, channelId)
      metrics.end(true)

      if (!result) {
        return null
      }

      // guild情報を追加（getChannelInfoはguildIdのみ返すため、guild情報を取得）
      if (result.guildId) {
        const guildInfo = await this.guildManager.getGuildInfo(this.client, result.guildId)
        return {
          id: result.id,
          name: result.name,
          type: result.type,
          guild: { id: guildInfo.id, name: guildInfo.name }
        }
      }

      // DMチャンネルなど、guildがない場合
      throw new Error('Channel is not in a guild')
    } catch (error) {
      metrics.end(false)
      throw error
    }
  }

  /**
   * ギルド情報取得
   * GuildManagerサービスに委譲
   */
  async getGuildInfo(guildId: string): Promise<{
    id: string
    name: string
    memberCount: number
    channels: Array<{ id: string; name: string; type: string }>
  }> {
    const metrics = this.performanceOrchestrator.startDiscordApiMonitoring('discord.getGuildInfo', 'GET')
    try {
      const result = await this.guildManager.getGuildInfo(this.client, guildId)
      metrics.end(true)
      return result
    } catch (error) {
      metrics.end(false)
      throw error
    }
  }

  /**
   * メッセージ送信
   * ChannelManagerサービスに委譲
   */
  async sendMessage(channelId: string, content: string, options?: any): Promise<any> {
    const metrics = this.performanceOrchestrator.startDiscordApiMonitoring('discord.sendMessage', 'POST')
    try {
      const result = await this.channelManager.sendMessage(this.client, channelId, content, options)
      metrics.end(true)
      return result
    } catch (error) {
      metrics.end(false)
      throw error
    }
  }

  /**
   * チャンネル作成
   * ChannelManagerサービスに委譲
   */
  async createChannel(guildId: string, name: string, options?: any): Promise<any> {
    const metrics = this.performanceOrchestrator.startDiscordApiMonitoring('discord.createChannel', 'POST')
    try {
      const result = await this.channelManager.createChannel(this.client, guildId, name, options)
      metrics.end(true)
      return result
    } catch (error) {
      metrics.end(false)
      throw error
    }
  }

  /**
   * パフォーマンス統計取得
   * 監視サービスから統計情報を取得
   */
  getPerformanceStats(): {
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
    const summary = this.performanceOrchestrator.getPerformanceSummary()
    return summary.discord
  }

  /**
   * ヘルスチェック
   * 各サービスの状態を統合的にチェック
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical'
    services: {
      client: boolean
      interactions: boolean
      guilds: boolean
      channels: boolean
    }
    issues: string[]
    metrics: {
      avgResponseTime: number
      errorRate: number
      activeAlerts: number
    }
  } {
    const performanceHealth = this.performanceOrchestrator.getSystemHealth()

    return {
      status: performanceHealth.status,
      services: {
        client: this.initialized && !!this.client,
        interactions: this.interactionHandler.isInitialized(),
        guilds: this.guildManager.isInitialized(),
        channels: this.channelManager.isInitialized()
      },
      issues: performanceHealth.issues,
      metrics: {
        avgResponseTime: performanceHealth.metrics.discord.avgResponseTime || 0,
        errorRate: performanceHealth.metrics.discord.errorRate || 0,
        activeAlerts: performanceHealth.metrics.alerts.active || 0
      }
    }
  }

  /**
   * 定期メンテナンス実行
   * 各サービスのメンテナンスを協調実行
   */
  async performMaintenance(): Promise<void> {
    this.logger.log('定期メンテナンスを開始します')

    try {
      await Promise.all([
        // メンテナンスは定期的に自動実行される
        // eslint-disable-next-line @typescript-eslint/await-thenable -- guildManager.cleanup は同期 void。channelManager.cleanup（async）と並列実行する塊として意図的に内包
        this.guildManager.cleanup(),
        this.channelManager.cleanup()
      ])

      this.logger.log('定期メンテナンスが完了しました')
    } catch (error) {
      this.logger.error('定期メンテナンス中にエラーが発生しました', error)
    }
  }

  /**
   * 初期化状態取得
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Clientインスタンス取得
   * 後方互換性のため提供
   */
  getClient(): Client {
    return this.client
  }
}
