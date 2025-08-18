import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  Guild,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  CategoryChannel,
  ChannelType,
  OverwriteResolvable,
  GuildMember
} from 'discord.js'
import { ErrorHandler } from '../../utils/error-handler'
import { AppConfigService } from '../../config/config.service'

/**
 * チャンネル作成・権限管理サービス
 *
 * 責務：
 * - チャンネル作成・設定
 * - 権限管理・アクセス制御
 * - カテゴリ管理
 */
@Injectable()
export class ChannelCreatorService {
  private readonly logger = new Logger(ChannelCreatorService.name)

  constructor(private readonly appConfigService: AppConfigService) {
    this.logger.debug('Channel creator service initialized')
  }

  /**
   * チャンネル情報を取得
   */
  async getChannelInfo(
    client: Client,
    channelId: string
  ): Promise<{
    id: string
    name: string
    type: string
    guildId?: string
    parentId?: string
    topic?: string
    memberCount?: number
  } | null> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel) {
        return null
      }

      const result: any = {
        id: channel.id,
        name: 'name' in channel ? channel.name : 'Unknown',
        type: ChannelType[channel.type] || 'Unknown'
      }

      if ('guildId' in channel && channel.guildId) {
        result.guildId = channel.guildId
      }

      if ('parentId' in channel && channel.parentId) {
        result.parentId = channel.parentId
      }

      if ('topic' in channel && channel.topic) {
        result.topic = channel.topic
      }

      if (channel.isThread()) {
        result.memberCount = channel.memberCount
      }

      this.logger.debug(`Retrieved channel info: ${channelId}`)
      return result
    } catch (error) {
      this.logger.error(`Failed to get channel info: ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          operation: 'getChannelInfo'
        },
        'ChannelCreatorService'
      )

      return null
    }
  }

  /**
   * チャンネルを作成
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
      position?: number
      nsfw?: boolean
      bitrate?: number
      userLimit?: number
      rateLimitPerUser?: number
    }
  ): Promise<TextChannel | NewsChannel | null> {
    try {
      const guild = await client.guilds.fetch(guildId)

      if (!guild) {
        throw new Error(`Guild not found: ${guildId}`)
      }

      const channelOptions: any = {
        name: name,
        type: options?.type || ChannelType.GuildText
      }

      if (options?.parent) {
        channelOptions.parent = options.parent
      }

      if (options?.topic) {
        channelOptions.topic = options.topic
      }

      if (options?.permissions) {
        channelOptions.permissionOverwrites = options.permissions
      }

      if (options?.position !== undefined) {
        channelOptions.position = options.position
      }

      if (options?.nsfw !== undefined) {
        channelOptions.nsfw = options.nsfw
      }

      if (options?.rateLimitPerUser !== undefined) {
        channelOptions.rateLimitPerUser = options.rateLimitPerUser
      }

      // ボイスチャンネル固有のオプション
      if (options?.type === ChannelType.GuildVoice) {
        if (options?.bitrate) {
          channelOptions.bitrate = options.bitrate
        }
        if (options?.userLimit) {
          channelOptions.userLimit = options.userLimit
        }
      }

      const channel = await guild.channels.create(channelOptions)

      this.logger.log(`Channel created successfully: ${channel.id} (${name}) in guild ${guildId}`)
      return channel as TextChannel | NewsChannel
    } catch (error) {
      this.logger.error(`Failed to create channel: ${name} in guild ${guildId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          guildId,
          channelName: name,
          channelType: options?.type,
          operation: 'createChannel'
        },
        'ChannelCreatorService'
      )

      throw error
    }
  }

  /**
   * スレッドを作成
   */
  async createThread(
    client: Client,
    channelId: string,
    name: string,
    options?: {
      type?: ChannelType.PublicThread | ChannelType.PrivateThread
      autoArchiveDuration?: 60 | 1440 | 4320 | 10080
      reason?: string
    }
  ): Promise<ThreadChannel | null> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel?.isTextBased() || channel.isThread()) {
        throw new Error(`Channel ${channelId} cannot create threads`)
      }

      const threadOptions: any = {
        name: name,
        type: options?.type || ChannelType.PublicThread
      }

      if (options?.autoArchiveDuration) {
        threadOptions.autoArchiveDuration = options.autoArchiveDuration
      }

      if (options?.reason) {
        threadOptions.reason = options.reason
      }

      const thread = await (channel as TextChannel).threads.create(threadOptions)

      this.logger.log(`Thread created successfully: ${thread.id} (${name}) in channel ${channelId}`)
      return thread
    } catch (error) {
      this.logger.error(`Failed to create thread: ${name} in channel ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          threadName: name,
          threadType: options?.type,
          operation: 'createThread'
        },
        'ChannelCreatorService'
      )

      return null
    }
  }

  /**
   * チャンネル権限をチェック
   */
  async checkChannelPermissions(
    client: Client,
    channelId: string,
    userId: string,
    permissions: string[]
  ): Promise<{
    hasAccess: boolean
    permissions: Record<string, boolean>
    member?: GuildMember
  }> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel || !('guild' in channel) || !channel.guild) {
        return {
          hasAccess: false,
          permissions: Object.fromEntries(permissions.map((p) => [p, false]))
        }
      }

      const member = await channel.guild.members.fetch(userId)
      const permissionResults: Record<string, boolean> = {}

      for (const permission of permissions) {
        const hasPermission = member.permissions.has(permission as any)
        permissionResults[permission] = hasPermission
      }

      const hasAccess = Object.values(permissionResults).some(Boolean)

      this.logger.debug(`Permission check completed for user ${userId} in channel ${channelId}`)

      return {
        hasAccess,
        permissions: permissionResults,
        member
      }
    } catch (error) {
      this.logger.error(`Failed to check channel permissions: ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          userId,
          permissions,
          operation: 'checkChannelPermissions'
        },
        'ChannelCreatorService'
      )

      return {
        hasAccess: false,
        permissions: Object.fromEntries(permissions.map((p) => [p, false]))
      }
    }
  }

  /**
   * チャンネル権限を設定
   */
  async setChannelPermissions(
    client: Client,
    channelId: string,
    targetId: string,
    permissions: {
      allow?: string[]
      deny?: string[]
    },
    isRole: boolean = false
  ): Promise<boolean> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel || !('permissionOverwrites' in channel)) {
        throw new Error(`Channel ${channelId} does not support permission overwrites`)
      }

      const overwrites: any = {}

      if (permissions.allow) {
        overwrites.allow = permissions.allow
      }

      if (permissions.deny) {
        overwrites.deny = permissions.deny
      }

      await (channel as TextChannel | NewsChannel).permissionOverwrites.create(targetId, overwrites)

      this.logger.log(`Permissions set for ${isRole ? 'role' : 'user'} ${targetId} in channel ${channelId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to set channel permissions: ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          targetId,
          permissions,
          isRole,
          operation: 'setChannelPermissions'
        },
        'ChannelCreatorService'
      )

      return false
    }
  }

  /**
   * カテゴリチャンネルを作成
   */
  async createCategory(
    client: Client,
    guildId: string,
    name: string,
    options?: {
      position?: number
      permissions?: OverwriteResolvable[]
    }
  ): Promise<CategoryChannel | null> {
    try {
      const guild = await client.guilds.fetch(guildId)

      if (!guild) {
        throw new Error(`Guild not found: ${guildId}`)
      }

      const categoryOptions: any = {
        name: name,
        type: ChannelType.GuildCategory
      }

      if (options?.position !== undefined) {
        categoryOptions.position = options.position
      }

      if (options?.permissions) {
        categoryOptions.permissionOverwrites = options.permissions
      }

      const category = await guild.channels.create(categoryOptions)

      this.logger.log(`Category created successfully: ${category.id} (${name}) in guild ${guildId}`)
      return category as CategoryChannel
    } catch (error) {
      this.logger.error(`Failed to create category: ${name} in guild ${guildId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          guildId,
          categoryName: name,
          operation: 'createCategory'
        },
        'ChannelCreatorService'
      )

      return null
    }
  }

  /**
   * チャンネルタイプを変換
   */
  convertChannelType(type: string): ChannelType {
    const typeMap: Record<string, ChannelType> = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      category: ChannelType.GuildCategory,
      news: ChannelType.GuildAnnouncement,
      stage: ChannelType.GuildStageVoice,
      forum: ChannelType.GuildForum,
      public_thread: ChannelType.PublicThread,
      private_thread: ChannelType.PrivateThread
    }

    return typeMap[type.toLowerCase()] || ChannelType.GuildText
  }

  /**
   * チャンネル設定を更新
   */
  async updateChannelSettings(
    client: Client,
    channelId: string,
    settings: {
      name?: string
      topic?: string
      nsfw?: boolean
      rateLimitPerUser?: number
      position?: number
    }
  ): Promise<boolean> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel || !('edit' in channel)) {
        throw new Error(`Channel ${channelId} cannot be edited`)
      }

      await (channel as TextChannel | NewsChannel).edit(settings)

      this.logger.log(`Channel settings updated: ${channelId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to update channel settings: ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          settings,
          operation: 'updateChannelSettings'
        },
        'ChannelCreatorService'
      )

      return false
    }
  }

  /**
   * チャンネルを削除
   */
  async deleteChannel(client: Client, channelId: string, reason?: string): Promise<boolean> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel || !('delete' in channel)) {
        throw new Error(`Channel ${channelId} cannot be deleted`)
      }

      await (channel as TextChannel | NewsChannel | CategoryChannel).delete(reason)

      this.logger.log(`Channel deleted: ${channelId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to delete channel: ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          reason,
          operation: 'deleteChannel'
        },
        'ChannelCreatorService'
      )

      return false
    }
  }
}
