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
  ChannelType
} from 'discord.js'
import { MessageManagerService, ChannelCacheService, ChannelCreatorService } from './channel'
import type {
  DiscordChannelCreationOptions,
  DiscordGuildChannelType,
  DiscordGuildChannelTypeName,
  DiscordSendMessageOptions
} from '../interfaces/discord-operation-options.interface'

type DiscordSdkChannelCreationOptions = Omit<DiscordChannelCreationOptions, 'type'> & {
  type?: DiscordGuildChannelType
}

const GUILD_CHANNEL_TYPE_NAMES: ReadonlySet<DiscordGuildChannelTypeName> = new Set([
  'text',
  'voice',
  'category',
  'news',
  'stage',
  'forum'
])

const GUILD_CHANNEL_TYPES: ReadonlySet<DiscordGuildChannelType> = new Set([
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum
])

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
    options?: DiscordSendMessageOptions
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
    options?: DiscordChannelCreationOptions
  ): Promise<TextChannel | NewsChannel | null> {
    let sdkOptions: DiscordSdkChannelCreationOptions | undefined

    if (options) {
      const { type, ...rest } = options
      let sdkType: DiscordGuildChannelType | undefined

      if (typeof type === 'string' && !GUILD_CHANNEL_TYPE_NAMES.has(type)) {
        throw new Error(`Unsupported guild channel type: ${type}`)
      }

      if (typeof type === 'number' && !GUILD_CHANNEL_TYPES.has(type)) {
        throw new Error(`Unsupported guild channel type: ${type}`)
      }

      if (typeof type === 'string') {
        const convertedType = this.channelCreator.convertChannelType(type)
        if (!GUILD_CHANNEL_TYPES.has(convertedType as DiscordGuildChannelType)) {
          throw new Error(`Unsupported guild channel type: ${type}`)
        }
        sdkType = convertedType as DiscordGuildChannelType
      } else {
        sdkType = type
      }

      sdkOptions = {
        ...rest,
        type: sdkType
      }
    }

    return this.channelCreator.createChannel(client, guildId, name, sdkOptions)
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
