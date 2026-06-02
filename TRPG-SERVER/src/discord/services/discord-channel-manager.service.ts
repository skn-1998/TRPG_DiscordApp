import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ChannelType,
  OverwriteResolvable
} from 'discord.js'
import { AppConfigService } from '../../config/config.service'
import { MessageManagerService, ChannelCacheService, ChannelCreatorService } from './channel'

/**
 * Discord チャンネル管理オーケストレーターサービス
 *
 * 各専門サービスを統合し、チャンネル操作の統一インターフェースを提供
 * 従来の大型サービス（562行）を3つの専門サービスに分割した結果のオーケストレーター
 */
@Injectable()
export class DiscordChannelManagerService {
  private readonly logger = new Logger(DiscordChannelManagerService.name)
  private initialized = false

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly messageManager: MessageManagerService,
    private readonly channelCache: ChannelCacheService,
    private readonly channelCreator: ChannelCreatorService
  ) {}

  /**
   * サービスを初期化
   */
  async initialize(_client: Client): Promise<void> {
    if (this.initialized) {
      return
    }

    this.initialized = true
    this.logger.log('DiscordChannelManagerService initialized as orchestrator')
  }

  /**
   * チャンネルを取得（キャッシュサービスに委譲）
   */
  async getChannel(client: Client, channelId: string): Promise<TextChannel | NewsChannel | ThreadChannel | null> {
    return this.channelCache.getChannel(client, channelId)
  }

  /**
   * メッセージを送信（メッセージマネージャーに委譲）
   */
  async sendMessage(
    client: Client,
    channelId: string,
    content: string,
    options?: {
      embeds?: EmbedBuilder[]
      components?: ActionRowBuilder<ButtonBuilder>[]
      files?: any[]
    }
  ): Promise<Message | null> {
    try {
      return await this.messageManager.sendMessage(client, channelId, content, options)
    } catch (error) {
      this.logger.error(`Failed to send message via orchestrator: ${channelId}`, error)
      return null
    }
  }

  /**
   * メッセージを編集（メッセージマネージャーに委譲）
   */
  async editMessage(
    client: Client,
    channelId: string,
    messageId: string,
    content?: string,
    options?: {
      embeds?: EmbedBuilder[]
      components?: ActionRowBuilder<ButtonBuilder>[]
    }
  ): Promise<Message | null> {
    try {
      return await this.messageManager.editMessage(client, channelId, messageId, content, options)
    } catch (error) {
      this.logger.error(`Failed to edit message via orchestrator: ${messageId}`, error)
      return null
    }
  }

  /**
   * メッセージを削除（メッセージマネージャーに委譲）
   */
  async deleteMessages(client: Client, channelId: string, messageIds: string[], reason?: string): Promise<void> {
    return this.messageManager.deleteMessages(client, channelId, messageIds, reason)
  }

  /**
   * チャンネル権限をチェック（チャンネル作成サービスに委譲）
   */
  async checkChannelPermissions(
    client: Client,
    channelId: string,
    userId: string,
    permissions: string[]
  ): Promise<{
    hasAccess: boolean
    permissions: Record<string, boolean>
  }> {
    const result = await this.channelCreator.checkChannelPermissions(client, channelId, userId, permissions)
    return {
      hasAccess: result.hasAccess,
      permissions: result.permissions
    }
  }

  /**
   * チャンネル情報を取得（チャンネル作成サービスに委譲）
   */
  async getChannelInfo(
    client: Client,
    channelId: string
  ): Promise<{
    id: string
    name: string
    type: string
    guildId?: string
  } | null> {
    return this.channelCreator.getChannelInfo(client, channelId)
  }

  /**
   * チャンネルを作成（チャンネル作成サービスに委譲）
   */
  async createChannel(
    client: Client,
    guildId: string,
    name: string,
    options?: {
      type?: ChannelType
      parent?: string
      topic?: string
      permissions?: OverwriteResolvable[]
    }
  ): Promise<TextChannel | NewsChannel | null> {
    return this.channelCreator.createChannel(client, guildId, name, options)
  }

  /**
   * 初期化状態を取得
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * キャッシュクリーンアップ（キャッシュサービスに委譲）
   */
  async cleanup(): Promise<void> {
    await this.channelCache.performMaintenance()
    this.logger.debug('Channel manager cleanup completed')
  }

  /**
   * パフォーマンス統計情報を取得
   */
  getStats(): {
    cache: {
      channelCacheSize: number
      totalMessagesCached: number
      memoryUsageEstimate: number
    }
    status: {
      initialized: boolean
      services: {
        messageManager: boolean
        channelCache: boolean
        channelCreator: boolean
      }
    }
  } {
    const cacheStats = this.channelCache.getCacheStats()

    return {
      cache: {
        channelCacheSize: cacheStats.channelCacheSize,
        totalMessagesCached: cacheStats.totalMessagesCached,
        memoryUsageEstimate: cacheStats.memoryUsageEstimate
      },
      status: {
        initialized: this.initialized,
        services: {
          messageManager: !!this.messageManager,
          channelCache: !!this.channelCache,
          channelCreator: !!this.channelCreator
        }
      }
    }
  }

  /**
   * 旧メソッドとの互換性維持
   * @deprecated Use appropriate specialized service methods instead
   */
  async sendMessageWithReply(
    client: Client,
    channelId: string,
    content: string,
    replyToMessageId: string
  ): Promise<Message | null> {
    this.logger.warn('sendMessageWithReply is deprecated. Use MessageManagerService directly.')

    try {
      const channel = await this.getChannel(client, channelId)
      if (!channel) return null

      const replyMessage = await channel.messages.fetch(replyToMessageId)
      return await replyMessage.reply(content)
    } catch (error) {
      this.logger.error(`Failed to send reply message: ${channelId}`, error)
      return null
    }
  }

  /**
   * 専門サービスへの直接アクセス
   * 高度な操作が必要な場合に使用
   */
  getMessageManager(): MessageManagerService {
    return this.messageManager
  }

  getChannelCache(): ChannelCacheService {
    return this.channelCache
  }

  getChannelCreator(): ChannelCreatorService {
    return this.channelCreator
  }
}
