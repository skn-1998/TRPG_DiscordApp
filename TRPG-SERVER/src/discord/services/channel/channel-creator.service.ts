import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  CategoryChannel,
  ChannelType,
  OverwriteResolvable,
  GuildMember
} from 'discord.js'
import { ErrorHandler } from '../../../core/http/error-handler'
import {
  buildChannelInfo,
  buildChannelCreateOptions,
  buildThreadCreateOptions,
  buildCategoryCreateOptions,
  buildPermissionOverwrites,
  buildDeniedPermissionMap,
  summarizePermissions,
  hasAnyPermission,
  convertChannelType
} from './channel-creator.pure'

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

  constructor() {
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

      // 組立ロジックは純関数 buildChannelInfo に委譲（I/O 値だけを抜き出して渡す）。
      const isThread = channel.isThread()
      const result = buildChannelInfo({
        id: channel.id,
        type: channel.type,
        name: 'name' in channel ? channel.name : undefined,
        guildId: 'guildId' in channel ? channel.guildId : undefined,
        parentId: 'parentId' in channel ? channel.parentId : undefined,
        topic: 'topic' in channel ? channel.topic : undefined,
        isThread,
        memberCount: isThread ? channel.memberCount : undefined
      })

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

      const channelOptions = buildChannelCreateOptions(name, options)

      const channel = await guild.channels.create(channelOptions as any)

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

      const threadOptions = buildThreadCreateOptions(name, options)

      const thread = await (channel as TextChannel).threads.create(threadOptions as any)

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
          permissions: buildDeniedPermissionMap(permissions)
        }
      }

      const member = await channel.guild.members.fetch(userId)
      const permissionResults = summarizePermissions(permissions, (permission) =>
        member.permissions.has(permission as any)
      )

      const hasAccess = hasAnyPermission(permissionResults)

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
        permissions: buildDeniedPermissionMap(permissions)
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

      const overwrites = buildPermissionOverwrites(permissions)

      await (channel as TextChannel | NewsChannel).permissionOverwrites.create(targetId, overwrites as any)

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

      const categoryOptions = buildCategoryCreateOptions(name, options)

      const category = await guild.channels.create(categoryOptions as any)

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
    // 変換ロジックは純関数に委譲（公開 API は維持）。
    return convertChannelType(type)
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
