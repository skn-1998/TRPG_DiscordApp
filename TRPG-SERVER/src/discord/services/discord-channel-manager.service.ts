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
  MessageComponentInteraction,
  ChannelType,
  AttachmentBuilder
} from 'discord.js'
import { ErrorHandler } from '../../utils/error-handler'
import { AppConfigService } from '../../config/config.service'

/**
 * Discord チャンネル管理サービス
 * チャンネル操作の最適化とキャッシュ管理
 */
@Injectable()
export class DiscordChannelManagerService {
  private readonly logger = new Logger(DiscordChannelManagerService.name)
  private initialized = false
  private client: Client

  // チャンネルキャッシュ（パフォーマンス最適化）
  private channelCache = new Map<
    string,
    {
      channel: TextChannel | NewsChannel | ThreadChannel
      lastAccess: number
      messageCache: Map<string, Message>
    }
  >()

  // キャッシュ有効期限
  private readonly CACHE_TTL = 300000 // 5分
  private readonly MESSAGE_CACHE_LIMIT = 50 // メッセージキャッシュ上限

  constructor(private readonly appConfigService: AppConfigService) {}

  /**
   * サービスを初期化
   */
  async initialize(client: Client): Promise<void> {
    if (this.initialized) {
      return
    }

    this.client = client
    this.initialized = true
    this.logger.log('DiscordChannelManagerService initialized')
  }

  /**
   * 初期化状態を取得
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * キャッシュクリーンアップ
   */
  cleanup(): void {
    const now = Date.now()
    for (const [channelId, cache] of this.channelCache.entries()) {
      if (now - cache.lastAccess > this.CACHE_TTL) {
        this.channelCache.delete(channelId)
      }
    }
  }

  /**
   * チャンネル取得（キャッシュ付き）
   */
  async getChannel(client: Client, channelId: string): Promise<TextChannel | NewsChannel | ThreadChannel | null> {
    try {
      // キャッシュチェック
      const cached = this.channelCache.get(channelId)
      const now = Date.now()

      if (cached && now - cached.lastAccess < this.CACHE_TTL) {
        cached.lastAccess = now
        return cached.channel
      }

      // チャンネル取得
      const channel = await client.channels.fetch(channelId)

      if (!channel?.isTextBased() || channel.isDMBased()) {
        return null
      }

      // キャッシュ更新
      this.updateChannelCache(channel as TextChannel | NewsChannel | ThreadChannel)

      return channel as TextChannel | NewsChannel | ThreadChannel
    } catch (error) {
      this.logger.warn(`Failed to fetch channel: ${channelId}`, error)
      return null
    }
  }

  /**
   * メッセージ送信（最適化済み）
   */
  async sendMessage(
    client: Client,
    channelId: string,
    content: string,
    options?: {
      embeds?: EmbedBuilder[]
      components?: ActionRowBuilder<ButtonBuilder>[]
      files?: AttachmentBuilder[]
      reply?: { messageId: string; failIfNotExists?: boolean }
    }
  ): Promise<Message | null> {
    try {
      const channel = await this.getChannel(client, channelId)
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`)
      }

      // メッセージオプション構築
      const messageOptions: {
        content: string
        embeds?: EmbedBuilder[]
        components?: ActionRowBuilder<ButtonBuilder>[]
        files?: AttachmentBuilder[]
      } = { content }

      if (options?.embeds?.length) messageOptions.embeds = options.embeds
      if (options?.components?.length) messageOptions.components = options.components
      if (options?.files?.length) messageOptions.files = options.files

      let sentMessage: Message

      // リプライ指定がある場合
      if (options?.reply) {
        try {
          const replyMessage = await this.getMessageFromCache(channel, options.reply.messageId)
          if (replyMessage) {
            sentMessage = await replyMessage.reply(messageOptions)
          } else if (options.reply.failIfNotExists) {
            throw new Error(`Reply target message not found: ${options.reply.messageId}`)
          } else {
            sentMessage = await channel.send(messageOptions)
          }
        } catch (replyError) {
          if (options.reply.failIfNotExists) {
            throw replyError
          }
          // リプライに失敗した場合は通常送信
          sentMessage = await channel.send(messageOptions)
        }
      } else {
        sentMessage = await channel.send(messageOptions)
      }

      // メッセージキャッシュに追加
      this.addMessageToCache(channelId, sentMessage)

      this.logger.debug(`Message sent to channel: ${channelId}`)
      return sentMessage
    } catch (error) {
      await ErrorHandler.handleError(error, {
        context: 'send-channel-message',
        channelId,
        additionalData: { contentLength: content?.length }
      })
      return null
    }
  }

  /**
   * メッセージ編集（最適化済み）
   */
  async editMessage(
    client: Client,
    channelId: string,
    messageId: string,
    content: string,
    options?: {
      embeds?: EmbedBuilder[]
      components?: ActionRowBuilder<ButtonBuilder>[]
    }
  ): Promise<Message | null> {
    try {
      const channel = await this.getChannel(client, channelId)
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`)
      }

      // キャッシュから取得を試行
      let message = await this.getMessageFromCache(channel, messageId)

      if (!message) {
        // キャッシュにない場合は取得
        message = await channel.messages.fetch(messageId)
        this.addMessageToCache(channel.id, message)
      }

      // メッセージ編集オプション構築
      const editOptions: {
        content: string
        embeds?: EmbedBuilder[]
        components?: ActionRowBuilder<ButtonBuilder>[]
      } = { content }

      if (options?.embeds?.length) editOptions.embeds = options.embeds
      if (options?.components?.length) editOptions.components = options.components

      const editedMessage = await message.edit(editOptions)

      // キャッシュ更新
      this.addMessageToCache(channelId, editedMessage)

      this.logger.debug(`Message edited: ${messageId} in channel ${channelId}`)
      return editedMessage
    } catch (error) {
      await ErrorHandler.handleError(error, {
        context: 'edit-channel-message',
        channelId,
        messageId
      })
      return null
    }
  }

  /**
   * メッセージ削除（バッチ処理対応）
   */
  async deleteMessages(
    client: Client,
    channelId: string,
    messageIds: string[]
  ): Promise<{ success: string[]; failed: string[] }> {
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] }

    try {
      const channel = await this.getChannel(client, channelId)
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`)
      }

      // バッチ削除（Discord APIの制限に対応）
      const MAX_BULK_DELETE = 100
      const recentMessages: string[] = []
      const oldMessages: string[] = []

      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000

      for (const messageId of messageIds) {
        const timestamp = this.extractTimestampFromSnowflake(messageId)
        if (timestamp > twoWeeksAgo) {
          recentMessages.push(messageId)
        } else {
          oldMessages.push(messageId)
        }
      }

      // 2週間以内のメッセージは一括削除
      for (let i = 0; i < recentMessages.length; i += MAX_BULK_DELETE) {
        const batch = recentMessages.slice(i, i + MAX_BULK_DELETE)
        try {
          await channel.bulkDelete(batch, true)
          results.success.push(...batch)
        } catch (error) {
          this.logger.warn(`Bulk delete failed for batch:`, error)
          results.failed.push(...batch)
        }
      }

      // 古いメッセージは個別削除
      const deletePromises = oldMessages.map(async (messageId) => {
        try {
          const message = await channel.messages.fetch(messageId)
          await message.delete()
          results.success.push(messageId)
        } catch {
          results.failed.push(messageId)
        }
      })

      await Promise.allSettled(deletePromises)

      // キャッシュから削除
      messageIds.forEach((id) => this.removeMessageFromCache(channelId, id))

      this.logger.debug(`Deleted messages: ${results.success.length} success, ${results.failed.length} failed`)
    } catch (error) {
      await ErrorHandler.handleError(error, {
        context: 'delete-channel-messages',
        channelId,
        messageCount: messageIds.length
      })
      results.failed.push(...messageIds)
    }

    return results
  }

  /**
   * チャンネル権限チェック
   */
  async checkChannelPermissions(
    client: Client,
    channelId: string,
    userId: string
  ): Promise<{ canRead: boolean; canWrite: boolean; canManage: boolean }> {
    try {
      const channel = await this.getChannel(client, channelId)
      if (!channel) {
        return { canRead: false, canWrite: false, canManage: false }
      }

      const member = await channel.guild.members.fetch(userId)
      const permissions = channel.permissionsFor(member)

      return {
        canRead: permissions?.has('ViewChannel') || false,
        canWrite: permissions?.has('SendMessages') || false,
        canManage: permissions?.has('ManageMessages') || false
      }
    } catch (error) {
      this.logger.warn(`Failed to check permissions for ${userId} in ${channelId}`, error)
      return { canRead: false, canWrite: false, canManage: false }
    }
  }

  /**
   * チャンネルキャッシュ更新
   */
  private updateChannelCache(channel: TextChannel | NewsChannel | ThreadChannel): void {
    this.channelCache.set(channel.id, {
      channel,
      lastAccess: Date.now(),
      messageCache: new Map()
    })
  }

  /**
   * メッセージキャッシュ取得
   */
  private async getMessageFromCache(
    channel: TextChannel | NewsChannel | ThreadChannel,
    messageId: string
  ): Promise<Message | null> {
    const cached = this.channelCache.get(channel.id)
    if (cached?.messageCache.has(messageId)) {
      return cached.messageCache.get(messageId) || null
    }

    try {
      const message = await channel.messages.fetch(messageId)
      this.addMessageToCache(channel.id, message)
      return message
    } catch {
      return null
    }
  }

  /**
   * メッセージキャッシュに追加
   */
  private addMessageToCache(channelId: string, message: Message): void {
    const cached = this.channelCache.get(channelId)
    if (!cached) return

    // キャッシュサイズ制限
    if (cached.messageCache.size >= this.MESSAGE_CACHE_LIMIT) {
      const oldestKey = cached.messageCache.keys().next().value
      if (oldestKey) {
        cached.messageCache.delete(oldestKey)
      }
    }

    cached.messageCache.set(message.id, message)
  }

  /**
   * メッセージキャッシュから削除
   */
  private removeMessageFromCache(channelId: string, messageId: string): void {
    const cached = this.channelCache.get(channelId)
    if (cached) {
      cached.messageCache.delete(messageId)
    }
  }

  /**
   * Snowflakeから timestamp 抽出
   */
  private extractTimestampFromSnowflake(snowflake: string): number {
    const DISCORD_EPOCH = 1420070400000
    return parseInt(snowflake) / 4194304 + DISCORD_EPOCH
  }

  /**
   * キャッシュクリア
   */
  clearCache(channelId?: string): void {
    if (channelId) {
      this.channelCache.delete(channelId)
    } else {
      this.channelCache.clear()
    }
    this.logger.debug(`Cleared channel cache: ${channelId || 'all'}`)
  }

  /**
   * 期限切れキャッシュクリーンアップ
   */
  cleanupExpiredCache(): void {
    const now = Date.now()
    const expiredChannels: string[] = []

    for (const [channelId, cached] of this.channelCache.entries()) {
      if (now - cached.lastAccess > this.CACHE_TTL) {
        expiredChannels.push(channelId)
      }
    }

    expiredChannels.forEach((channelId) => this.channelCache.delete(channelId))

    if (expiredChannels.length > 0) {
      this.logger.debug(`Cleaned up ${expiredChannels.length} expired channel cache entries`)
    }
  }

  /**
   * キャッシュ統計
   */
  getCacheStats(): {
    cachedChannels: number
    totalCachedMessages: number
    averageMessagesPerChannel: number
  } {
    const cachedChannels = this.channelCache.size
    let totalMessages = 0

    for (const cached of this.channelCache.values()) {
      totalMessages += cached.messageCache.size
    }

    return {
      cachedChannels,
      totalCachedMessages: totalMessages,
      averageMessagesPerChannel: cachedChannels > 0 ? Math.round(totalMessages / cachedChannels) : 0
    }
  }

  /**
   * チャンネル情報取得
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
    try {
      const channel = await this.getChannel(client, channelId)
      if (!channel) {
        return null
      }

      return {
        id: channel.id,
        name: channel.name,
        type: ChannelType[channel.type] || 'Unknown',
        guildId: channel.guildId
      }
    } catch (error) {
      this.logger.warn(`Failed to get channel info: ${channelId}`, error)
      return null
    }
  }

  /**
   * チャンネル作成
   */
  async createChannel(
    client: Client,
    guildId: string,
    name: string,
    options?: {
      type?: 'text' | 'voice' | 'category'
      parent?: string
      topic?: string
      nsfw?: boolean
      rateLimitPerUser?: number
      position?: number
    }
  ): Promise<{ success: boolean; channel?: any; error?: string }> {
    try {
      const guild = await client.guilds.fetch(guildId)
      if (!guild) {
        return { success: false, error: 'Guild not found' }
      }

      const channelOptions = {
        name,
        type: this.convertChannelType(options?.type || 'text') as
          | ChannelType.GuildText
          | ChannelType.GuildVoice
          | ChannelType.GuildCategory,
        parent: options?.parent,
        topic: options?.topic,
        nsfw: options?.nsfw,
        rateLimitPerUser: options?.rateLimitPerUser,
        position: options?.position
      }

      const channel = await guild.channels.create(channelOptions)

      // キャッシュに追加
      if (channel.isTextBased() && !channel.isDMBased()) {
        this.updateChannelCache(channel as TextChannel | NewsChannel | ThreadChannel)
      }

      this.logger.log(`Channel created: ${name} (${channel.id}) in guild ${guildId}`)

      return {
        success: true,
        channel: {
          id: channel.id,
          name: channel.name,
          type: ChannelType[channel.type]
        }
      }
    } catch (error) {
      this.logger.error(`Failed to create channel: ${name} in guild ${guildId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * チャンネルタイプ変換
   */
  private convertChannelType(type: string): ChannelType {
    switch (type.toLowerCase()) {
      case 'text':
        return ChannelType.GuildText
      case 'voice':
        return ChannelType.GuildVoice
      case 'category':
        return ChannelType.GuildCategory
      default:
        return ChannelType.GuildText
    }
  }
}
