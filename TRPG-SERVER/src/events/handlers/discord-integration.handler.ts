import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../core/events/typed-event.service'
import { EventPayload } from '../contracts'

/**
 * Discord Integration Event Handler
 * Discord統合システムのイベントハンドラー
 *
 * T2c: レガシーバス経由の listen/emit は全て dead（emit する者が居ない／
 * その emit を listen する者が居ない）であったため撤去。
 * 残るのは TypedEventService 経由の生フロー2件（ログ記録のみ）。
 */
@Injectable()
export class DiscordIntegrationHandler implements OnModuleInit {
  private readonly logger = new Logger(DiscordIntegrationHandler.name)

  constructor(private readonly typedEventService: TypedEventService) {}

  onModuleInit(): void {
    this.registerEventHandlers()
    this.logger.log('Discord Integration Handler initialized')
  }

  /**
   * イベントハンドラー登録
   */
  private registerEventHandlers(): void {
    // Embed Events（生フローを TypedEventService へ移設済み: T2b）
    this.typedEventService.on('discord.embed.update.requested', this.handleEmbedUpdateRequested.bind(this))

    // Notification Events（生フローを TypedEventService へ移設済み: T2b）
    this.typedEventService.on('discord.notification.requested', this.handleNotificationRequested.bind(this))

    this.logger.debug('Discord integration event handlers registered')
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
}
