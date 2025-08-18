import { Injectable, Logger } from '@nestjs/common'
import { Client, Guild, GuildChannel, ChannelType, TextChannel, PermissionsBitField } from 'discord.js'
import { SendMessageDto } from '../dto/send-message.dto'
import { CreateChannelDto } from '../dto/create-channel.dto'
import { AppConfigService } from '../../config/config.service'
import { ErrorHandler } from '../../utils/error-handler'

/**
 * Discord Guild（サーバー）管理サービス
 * DiscordServiceから分離してGuild関連操作を最適化
 */
@Injectable()
export class DiscordGuildManagerService {
  private readonly logger = new Logger(DiscordGuildManagerService.name)
  private initialized = false
  private client: Client

  // Guild情報キャッシュ（パフォーマンス最適化）
  private guildCache = new Map<
    string,
    {
      guild: Guild
      channels: Map<string, GuildChannel>
      lastUpdate: number
    }
  >()

  // キャッシュ有効期限（5分）
  private readonly CACHE_TTL = 300000

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
    this.logger.log('DiscordGuildManagerService initialized')
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
    for (const [guildId, cache] of this.guildCache.entries()) {
      if (now - cache.lastUpdate > this.CACHE_TTL) {
        this.guildCache.delete(guildId)
      }
    }
  }

  /**
   * ギルドチャンネル取得（キャッシュ付き）
   */
  async getGuildChannels(client: Client, guildId: string): Promise<GuildChannel[]> {
    try {
      const now = Date.now()
      const cached = this.guildCache.get(guildId)

      // キャッシュチェック
      if (cached && now - cached.lastUpdate < this.CACHE_TTL) {
        return Array.from(cached.channels.values())
      }

      // ギルド取得
      const guild = await client.guilds.fetch(guildId)
      if (!guild) {
        throw new Error(`Guild not found: ${guildId}`)
      }

      // チャンネル一覧取得
      const channels = await guild.channels.fetch()
      const channelMap = new Map<string, GuildChannel>()

      // nullチェックを追加
      for (const [id, channel] of channels.entries()) {
        if (channel) {
          channelMap.set(id, channel)
        }
      }

      // キャッシュ更新
      this.guildCache.set(guildId, {
        guild,
        channels: channelMap,
        lastUpdate: now
      })

      this.logger.debug(`Guild channels cached: ${guildId} (${channelMap.size} channels)`)
      return Array.from(channelMap.values())
    } catch (error) {
      await ErrorHandler.handleError(error, {
        context: 'get-guild-channels',
        guildId
      })
      throw error
    }
  }

  /**
   * チャンネル作成（最適化済み）
   */
  async createChannel(client: Client, createChannelDto: CreateChannelDto): Promise<GuildChannel> {
    try {
      const { guildId, name, type, parentId, topic } = createChannelDto

      const guild = await client.guilds.fetch(guildId)
      if (!guild) {
        throw new Error(`Guild not found: ${guildId}`)
      }

      // 権限チェック
      if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        throw new Error('Bot lacks permission to manage channels')
      }

      // チャンネル作成オプション構築
      const channelOptions: {
        name: string
        type:
          | ChannelType.GuildText
          | ChannelType.GuildVoice
          | ChannelType.GuildCategory
          | ChannelType.GuildAnnouncement
          | ChannelType.GuildStageVoice
          | ChannelType.GuildDirectory
          | ChannelType.GuildForum
          | ChannelType.GuildMedia
        parent?: string
        topic?: string
      } = {
        name,
        type: this.convertChannelType(type || 'GUILD_TEXT'),
        parent: parentId || undefined,
        topic: topic || undefined
      }

      // チャンネル作成
      const channel = await guild.channels.create(channelOptions)

      // キャッシュ更新
      this.updateChannelCache(guildId, channel)

      this.logger.log(`Channel created: ${name} (${channel.id}) in guild ${guildId}`)
      return channel
    } catch (error) {
      await ErrorHandler.handleError(error, {
        context: 'create-channel',
        channelName: createChannelDto.name,
        guildId: createChannelDto.guildId
      })
      throw error
    }
  }

  /**
   * メッセージ送信（最適化済み）
   */
  async sendMessage(client: Client, sendMessageDto: SendMessageDto): Promise<void> {
    try {
      const { channelId, content } = sendMessageDto

      if (!content) {
        throw new Error('Content is required for sending message')
      }

      // チャンネル取得（キャッシュ利用）
      const channel = await this.getChannelFromCache(client, channelId)

      if (!channel?.isTextBased()) {
        throw new Error(`Text channel not found or not accessible: ${channelId}`)
      }

      // メッセージ送信オプション構築
      const messageOptions: { content: string } = { content }

      // 並列処理で高速化
      await Promise.allSettled([(channel as TextChannel).send(messageOptions)])

      this.logger.debug(`Message sent to channel: ${channelId}`)
    } catch (error) {
      await ErrorHandler.handleError(error, {
        context: 'send-guild-message',
        channelId: sendMessageDto.channelId
      })
      throw error
    }
  }

  /**
   * Guild情報取得（統計情報付き）
   */
  async getGuildInfo(
    client: Client,
    guildId: string
  ): Promise<{
    id: string
    name: string
    memberCount: number
    channels: Array<{ id: string; name: string; type: string }>
  }> {
    try {
      const guild = await client.guilds.fetch(guildId)
      if (!guild) {
        throw new Error(`Guild not found: ${guildId}`)
      }

      // 並列処理で情報取得
      const [channels, members] = await Promise.all([guild.channels.fetch(), guild.members.fetch()])

      return {
        id: guild.id,
        name: guild.name,
        memberCount: members.size,
        channels: Array.from(channels.values())
          .filter((channel) => channel !== null)
          .map((channel) => ({
            id: channel!.id,
            name: channel!.name,
            type: ChannelType[channel!.type]
          }))
      }
    } catch (error) {
      await ErrorHandler.handleError(error, {
        context: 'get-guild-info',
        guildId
      })
      throw error
    }
  }

  /**
   * チャンネルタイプ変換
   */
  private convertChannelType(
    type: string
  ):
    | ChannelType.GuildText
    | ChannelType.GuildVoice
    | ChannelType.GuildCategory
    | ChannelType.GuildAnnouncement
    | ChannelType.GuildStageVoice
    | ChannelType.GuildDirectory
    | ChannelType.GuildForum
    | ChannelType.GuildMedia {
    switch (type.toLowerCase()) {
      case 'text':
        return ChannelType.GuildText
      case 'voice':
        return ChannelType.GuildVoice
      case 'category':
        return ChannelType.GuildCategory
      case 'news':
        return ChannelType.GuildAnnouncement
      case 'stage':
        return ChannelType.GuildStageVoice
      case 'forum':
        return ChannelType.GuildForum
      default:
        return ChannelType.GuildText
    }
  }

  /**
   * キャッシュからチャンネル取得
   */
  private async getChannelFromCache(client: Client, channelId: string): Promise<GuildChannel | null> {
    // 全Guildキャッシュからチャンネルを検索
    for (const cached of this.guildCache.values()) {
      const channel = cached.channels.get(channelId)
      if (channel) {
        return channel
      }
    }

    // キャッシュにない場合は直接取得
    try {
      const channel = await client.channels.fetch(channelId)
      return channel as GuildChannel
    } catch {
      return null
    }
  }

  /**
   * チャンネルキャッシュ更新
   */
  private updateChannelCache(guildId: string, channel: GuildChannel): void {
    const cached = this.guildCache.get(guildId)
    if (cached) {
      cached.channels.set(channel.id, channel)
      cached.lastUpdate = Date.now()
    }
  }

  /**
   * キャッシュクリア
   */
  clearCache(guildId?: string): void {
    if (guildId) {
      this.guildCache.delete(guildId)
      this.logger.debug(`Cleared cache for guild: ${guildId}`)
    } else {
      this.guildCache.clear()
      this.logger.debug('Cleared all guild cache')
    }
  }

  /**
   * キャッシュ統計
   */
  getCacheStats(): { cachedGuilds: number; totalChannels: number; oldestCache: number } {
    const now = Date.now()
    let totalChannels = 0
    let oldestCache = now

    for (const cached of this.guildCache.values()) {
      totalChannels += cached.channels.size
      if (cached.lastUpdate < oldestCache) {
        oldestCache = cached.lastUpdate
      }
    }

    return {
      cachedGuilds: this.guildCache.size,
      totalChannels,
      oldestCache: now - oldestCache
    }
  }

  /**
   * チャンネルアクセス権限検証
   */
  async verifyChannelAccess(
    client: Client,
    channelId: string,
    discordUserId: string
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    try {
      const channel = await client.channels.fetch(channelId)
      if (!channel) {
        return { hasAccess: false, reason: 'Channel not found' }
      }

      if (!channel.isTextBased()) {
        return { hasAccess: false, reason: 'Channel is not text-based' }
      }

      // チャンネルがギルドチャンネルかチェック
      if (!('guild' in channel) || !channel.guild) {
        return { hasAccess: false, reason: 'Channel is not in a guild' }
      }

      const guild = channel.guild
      const member = await guild.members.fetch(discordUserId)
      if (!member) {
        return { hasAccess: false, reason: 'User is not a member of the guild' }
      }

      // permissionsForメソッドが利用可能かチェック
      if (!('permissionsFor' in channel) || typeof channel.permissionsFor !== 'function') {
        return { hasAccess: false, reason: 'Cannot check permissions for this channel type' }
      }

      const permissions = (channel as GuildChannel).permissionsFor(member)
      if (!permissions?.has(PermissionsBitField.Flags.ViewChannel)) {
        return { hasAccess: false, reason: 'User lacks permission to view channel' }
      }

      return { hasAccess: true }
    } catch (error) {
      this.logger.error(`Error verifying channel access: ${channelId} for user ${discordUserId}`, error)
      return { hasAccess: false, reason: 'Error verifying access' }
    }
  }

  /**
   * ギルドアクセス権限検証
   */
  async verifyGuildAccess(
    client: Client,
    guildId: string,
    discordUserId: string
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    try {
      const guild = await client.guilds.fetch(guildId)
      if (!guild) {
        return { hasAccess: false, reason: 'Guild not found' }
      }

      const member = await guild.members.fetch(discordUserId)
      if (!member) {
        return { hasAccess: false, reason: 'User is not a member of the guild' }
      }

      return { hasAccess: true }
    } catch (error) {
      this.logger.error(`Error verifying guild access: ${guildId} for user ${discordUserId}`, error)
      return { hasAccess: false, reason: 'Error verifying access' }
    }
  }
}
