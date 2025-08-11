import { Injectable, Logger } from '@nestjs/common'
import { Client } from 'discord.js'
import { TypedEventEmitter } from '../shared/application/typed-event.service'
import { AppConfigService } from '../config/config.service'
import { DiscordClientService } from './services/discord-client.service'
import { CommandManagerService } from './services/command-manager.service'
import { DiscordInteractionHandlerService } from './services/discord-interaction-handler.service'
import { DiscordGuildManagerService } from './services/discord-guild-manager.service'
import { DiscordChannelManagerService } from './services/discord-channel-manager.service'
import { DiscordPerformanceMonitorService } from './services/discord-performance-monitor.service'
import { EventsService } from './events/events.service'
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
    private readonly eventsService: EventsService,
    private readonly commandsService: CommandsService,
    private readonly appConfigService: AppConfigService,
    private readonly commandManagerService: CommandManagerService,
    private readonly typedEventEmitter: TypedEventEmitter,
    private readonly interactionHandler: DiscordInteractionHandlerService,
    private readonly guildManager: DiscordGuildManagerService,
    private readonly channelManager: DiscordChannelManagerService,
    private readonly performanceMonitor: DiscordPerformanceMonitorService
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
      const initMetrics = this.performanceMonitor.startApiCall('discord.initialize', 'INIT')

      // TypedEventEmitterをクライアントにアタッチ（イベント駆動型）
      ;(this.client as any)['typedEventEmitter'] = this.typedEventEmitter

      // 各サービスにクライアントを設定（並列処理）
      await Promise.all([
        this.eventsService.loadClient(this.client),
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
      this.performanceMonitor.recordMemoryUsage()
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
    const metrics = this.performanceMonitor.startApiCall('discord.verifyChannelAccess', 'GET')
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
    const metrics = this.performanceMonitor.startApiCall('discord.verifyGuildAccess', 'GET')
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
    const metrics = this.performanceMonitor.startApiCall('discord.getChannelInfo', 'GET')
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
    const metrics = this.performanceMonitor.startApiCall('discord.getGuildInfo', 'GET')
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
    const metrics = this.performanceMonitor.startApiCall('discord.sendMessage', 'POST')
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
    const metrics = this.performanceMonitor.startApiCall('discord.createChannel', 'POST')
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
    return this.performanceMonitor.getStats()
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
    const performanceHealth = this.performanceMonitor.getHealthStatus()

    return {
      status: performanceHealth.status,
      services: {
        client: this.initialized && !!this.client,
        interactions: this.interactionHandler.isInitialized(),
        guilds: this.guildManager.isInitialized(),
        channels: this.channelManager.isInitialized()
      },
      issues: performanceHealth.issues,
      metrics: performanceHealth.metrics
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
        this.performanceMonitor.performMaintenance(),
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
