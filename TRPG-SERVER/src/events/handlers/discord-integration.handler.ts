import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { GlobalEventBusService } from '../bus/global-event-bus.service'
import { TypedEventService } from '../../shared/application/typed-event.service'
import {
  DiscordChannelCreateRequestedEvent,
  DiscordChannelCreatedEvent,
  DiscordThreadCreateRequestedEvent,
  DiscordThreadCreatedEvent,
  DiscordEmbedUpdatedEvent,
  DiscordNotificationSentEvent,
  DiscordIntegrationErrorEvent,
  EventPayload
} from '../contracts'

/**
 * Discord Integration Event Handler
 * Discord統合システムのグローバルイベントハンドラー
 * Integration Events の統合処理を担当
 */
@Injectable()
export class DiscordIntegrationHandler implements OnModuleInit {
  private readonly logger = new Logger(DiscordIntegrationHandler.name)

  constructor(
    private readonly globalEventBus: GlobalEventBusService,
    private readonly typedEventService: TypedEventService
  ) {}

  onModuleInit(): void {
    this.registerEventHandlers()
    this.logger.log('Discord Integration Handler initialized')
  }

  /**
   * イベントハンドラー登録
   */
  private registerEventHandlers(): void {
    // Channel Events
    this.globalEventBus.on('discord.channel.create.requested', this.handleChannelCreateRequested.bind(this))
    this.globalEventBus.on('discord.channel.created', this.handleChannelCreated.bind(this))

    // Thread Events
    this.globalEventBus.on('discord.thread.create.requested', this.handleThreadCreateRequested.bind(this))
    this.globalEventBus.on('discord.thread.created', this.handleThreadCreated.bind(this))

    // Embed Events
    // discord.embed.update.requested は生フローを TypedEventService へ移設（T2b）
    this.typedEventService.on('discord.embed.update.requested', this.handleEmbedUpdateRequested.bind(this))
    this.globalEventBus.on('discord.embed.updated', this.handleEmbedUpdated.bind(this))

    // Notification Events
    // discord.notification.requested は生フローを TypedEventService へ移設（T2b）
    this.typedEventService.on('discord.notification.requested', this.handleNotificationRequested.bind(this))
    this.globalEventBus.on('discord.notification.sent', this.handleNotificationSent.bind(this))

    // Error Events
    this.globalEventBus.on('discord.integration.error', this.handleIntegrationError.bind(this))

    this.logger.debug('Discord integration event handlers registered')
  }

  /**
   * Discord チャンネル作成リクエストハンドラー
   */
  private async handleChannelCreateRequested(event: DiscordChannelCreateRequestedEvent): Promise<void> {
    this.logger.log(`📺 Discord Channel Create Requested: ${event.channelData.name}`)

    try {
      // このハンドラーではリクエストのログ記録と監査のみ実行
      // 実際のチャンネル作成処理は DiscordUIService が担当

      // 監査ログ発行
      await this.globalEventBus.emit({
        type: 'system.audit.logged',
        timestamp: new Date(),
        source: 'system',
        audit: {
          action: 'discord.channel.create.requested',
          userId: event.userId,
          resource: `channel:${event.channelData.name}`,
          details: {
            guildId: event.guildId,
            channelName: event.channelData.name,
            characterId: event.characterId
          },
          outcome: 'success'
        }
      })

      // パフォーマンス監視のためのメトリクス記録
      await this.globalEventBus.emit({
        type: 'system.performance.metrics.collected',
        timestamp: new Date(),
        source: 'monitoring',
        metrics: {
          cpu: 0,
          memory: 0,
          responseTime: 0,
          errorRate: 0,
          activeConnections: 0
        }
      })
    } catch (error) {
      this.logger.error(`❌ Discord channel create request processing failed`, error)

      // エラーイベント発行
      await this.globalEventBus.emit({
        type: 'discord.integration.error',
        timestamp: new Date(),
        source: 'discord',
        error: {
          code: 'CHANNEL_CREATE_REQUEST_ERROR',
          message: error instanceof Error ? error.message : String(error),
          operation: 'channel.create.requested',
          details: { channelData: event.channelData }
        }
      })
    }
  }

  /**
   * Discord チャンネル作成完了ハンドラー
   */
  private async handleChannelCreated(event: DiscordChannelCreatedEvent): Promise<void> {
    this.logger.log(`✅ Discord Channel Created: ${event.channel.name} (${event.channel.id})`)

    try {
      // キャラクターとチャンネルの関連付けがある場合、キャラクター更新イベント発行
      if (event.characterId) {
        // キャラクターのdiscordChannelId更新をリクエスト
        await this.globalEventBus.emit({
          type: 'character.update.requested',
          characterId: event.characterId,
          timestamp: new Date(),
          source: 'discord',
          userId: event.userId,
          updateData: {
            // 注意: 実際のCharacterモデルの更新はCharacterServiceが担当
            // ここではイベント発行のみ行う
          }
        })
      }

      // システム監査ログ
      await this.globalEventBus.emit({
        type: 'system.audit.logged',
        timestamp: new Date(),
        source: 'system',
        audit: {
          action: 'discord.channel.created',
          resource: `channel:${event.channel.id}`,
          details: {
            channelName: event.channel.name,
            guildId: event.channel.guildId,
            characterId: event.characterId
          },
          outcome: 'success'
        }
      })
    } catch (error) {
      this.logger.error(`❌ Discord channel created event processing failed`, error)
    }
  }

  /**
   * Discord スレッド作成リクエストハンドラー
   */
  private async handleThreadCreateRequested(event: DiscordThreadCreateRequestedEvent): Promise<void> {
    this.logger.log(`🧵 Discord Thread Create Requested: ${event.threadData?.name || 'Unknown Thread'}`)

    try {
      // 監査ログ発行（File-based Event Handlerが実際の処理を担当）
      await this.globalEventBus.emit({
        type: 'system.audit.logged',
        timestamp: new Date(),
        source: 'system',
        audit: {
          action: 'discord.thread.create.requested',
          userId: event.userId || 'unknown',
          resource: `thread:${event.threadData?.name || 'unknown'}`,
          details: {
            channelId: event.channelId,
            guildId: event.guildId,
            characterId: event.characterId
          },
          outcome: 'success'
        }
      })

      this.logger.debug(`Thread creation request logged for character: ${event.characterId || 'unknown'}`)
    } catch (error) {
      this.logger.error(`❌ Discord thread create request logging failed`, error)
    }
  }

  /**
   * Discord スレッド作成完了ハンドラー
   */
  private async handleThreadCreated(event: DiscordThreadCreatedEvent): Promise<void> {
    this.logger.log(`✅ Discord Thread Created: ${event.thread.name} (${event.thread.id})`)

    try {
      // キャラクターとスレッドの関連付け
      if (event.characterId) {
        await this.globalEventBus.emit({
          type: 'character.update.requested',
          characterId: event.characterId,
          timestamp: new Date(),
          source: 'discord',
          userId: event.userId,
          updateData: {
            // threadId更新はCharacterServiceが担当
          }
        })
      }
    } catch (error) {
      this.logger.error(`❌ Discord thread created event processing failed`, error)
    }
  }

  /**
   * Discord Embed更新リクエストハンドラー
   */
  private async handleEmbedUpdateRequested(event: EventPayload<'discord.embed.update.requested'>): Promise<void> {
    this.logger.debug(
      `🎨 Discord Embed Update Requested: ${event.embedData.embedType} for ${event.embedData.characterId}`
    )

    try {
      // Embed更新リクエストのログ記録
      // 実際のEmbed更新処理は各FeatureのEmbedManagerServiceが担当

      this.logger.debug(`Embed update requested: ${event.embedData.updateMode} in ${event.embedData.channelId}`)
    } catch (error) {
      this.logger.error(`❌ Discord embed update request processing failed`, error)
    }
  }

  /**
   * Discord Embed更新完了ハンドラー
   */
  private async handleEmbedUpdated(event: DiscordEmbedUpdatedEvent): Promise<void> {
    const status = event.embed.success ? '✅' : '❌'
    this.logger.debug(`${status} Discord Embed Updated: ${event.embed.embedType} (${event.embed.messageId})`)

    try {
      if (!event.embed.success) {
        // Embed更新失敗時のエラーログ
        await this.globalEventBus.emit({
          type: 'discord.integration.error',
          timestamp: new Date(),
          source: 'discord',
          error: {
            code: 'EMBED_UPDATE_FAILED',
            message: 'Discord embed update failed',
            operation: 'embed.update',
            details: {
              characterId: event.embed.characterId,
              embedType: event.embed.embedType
            }
          }
        })
      }
    } catch (error) {
      this.logger.error(`❌ Discord embed updated event processing failed`, error)
    }
  }

  /**
   * Discord 通知リクエストハンドラー
   */
  private async handleNotificationRequested(event: EventPayload<'discord.notification.requested'>): Promise<void> {
    this.logger.debug(`📢 Discord Notification Requested: ${event.notification.type}`)

    try {
      // 通知送信リクエストのログ記録
      // 実際の通知送信処理はDiscordUIServiceが担当

      this.logger.debug(`Notification: ${event.notification.title} → ${event.notification.channelId}`)
    } catch (error) {
      this.logger.error(`❌ Discord notification request processing failed`, error)
    }
  }

  /**
   * Discord 通知送信完了ハンドラー
   */
  private async handleNotificationSent(event: DiscordNotificationSentEvent): Promise<void> {
    const status = event.notification.success ? '✅' : '❌'
    this.logger.debug(`${status} Discord Notification Sent: ${event.notification.type}`)

    try {
      if (!event.notification.success) {
        // 通知送信失敗時のエラーログ
        await this.globalEventBus.emit({
          type: 'discord.integration.error',
          timestamp: new Date(),
          source: 'discord',
          error: {
            code: 'NOTIFICATION_SEND_FAILED',
            message: 'Discord notification send failed',
            operation: 'notification.send',
            details: { notificationType: event.notification.type }
          }
        })
      }
    } catch (error) {
      this.logger.error(`❌ Discord notification sent event processing failed`, error)
    }
  }

  /**
   * Discord統合エラーハンドラー
   */
  private async handleIntegrationError(event: DiscordIntegrationErrorEvent): Promise<void> {
    this.logger.error(`🚨 Discord Integration Error: ${event.error.code} - ${event.error.message}`)

    try {
      // システムエラーとして記録
      await this.globalEventBus.emit({
        type: 'system.error.occurred',
        timestamp: new Date(),
        source: 'system',
        error: {
          code: event.error.code,
          message: event.error.message,
          context: {
            operation: event.error.operation,
            details: event.error.details
          },
          severity: 'high'
        }
      })

      // 連続エラーの監視
      // TODO: 実装 - 一定時間内のエラー頻度をチェックして、必要に応じてアラートを発行
    } catch (error) {
      this.logger.error(`❌ Discord integration error event processing failed`, error)
    }
  }
}
