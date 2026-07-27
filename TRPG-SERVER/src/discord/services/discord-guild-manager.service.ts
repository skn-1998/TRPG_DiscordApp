import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  Guild,
  GuildChannel,
  ChannelType,
  TextChannel,
  PermissionsBitField,
  DiscordjsErrorCodes,
  RESTJSONErrorCodes
} from 'discord.js'
import type { GuildBasedChannel, PermissionsString } from 'discord.js'
import { SendMessageDto } from '../dto/send-message.dto'
import { CreateChannelDto } from '../dto/create-channel.dto'
import { ErrorHandler } from '../../core/http/error-handler'
import { GUILD_CATEGORY_TYPE } from '../interfaces/guild-channel-type.constant'

/**
 * verifyGuildManagePermission の拒否分類。
 * 上位（controller）が HTTP status へ写像するための判別子:
 * parent-not-found / parent-not-category は入力不正（400）、permission-denied は認可拒否（403）。
 * 基盤障害（API/通信の予期しない例外）は結果に含めず throw で伝播する（500）。
 */
export type GuildManagePermissionDenial = 'permission-denied' | 'parent-not-found' | 'parent-not-category'

export type GuildManagePermissionCheckResult =
  { hasPermission: true } | { hasPermission: false; denial: GuildManagePermissionDenial; reason: string }

/**
 * Discord Guild（サーバー）管理サービス
 * 旧 Discord 統合サービス（C-7 で解体済み）から分離してGuild関連操作を最適化
 */
@Injectable()
export class DiscordGuildManagerService {
  private readonly logger = new Logger(DiscordGuildManagerService.name)
  private initialized = false

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

  constructor() {}

  /**
   * サービスを初期化
   */
  async initialize(_client: Client): Promise<void> {
    if (this.initialized) {
      return
    }

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
            id: channel.id,
            name: channel.name,
            type: channel.type === ChannelType.GuildCategory ? GUILD_CATEGORY_TYPE : ChannelType[channel.type]
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
        const reason = 'Channel not found'
        this.warnAccessRejection('verifyChannelAccess', channelId, discordUserId, reason)
        return { hasAccess: false, reason }
      }

      if (!channel.isTextBased()) {
        const reason = 'Channel is not text-based'
        this.warnAccessRejection('verifyChannelAccess', channelId, discordUserId, reason)
        return { hasAccess: false, reason }
      }

      // チャンネルがギルドチャンネルかチェック
      if (!('guild' in channel) || !channel.guild) {
        const reason = 'Channel is not in a guild'
        this.warnAccessRejection('verifyChannelAccess', channelId, discordUserId, reason)
        return { hasAccess: false, reason }
      }

      const guild = channel.guild
      const member = await guild.members.fetch(discordUserId)
      if (!member) {
        const reason = 'User is not a member of the guild'
        this.warnAccessRejection('verifyChannelAccess', channelId, discordUserId, reason)
        return { hasAccess: false, reason }
      }

      // permissionsForメソッドが利用可能かチェック
      if (!('permissionsFor' in channel) || typeof channel.permissionsFor !== 'function') {
        const reason = 'Cannot check permissions for this channel type'
        this.warnAccessRejection('verifyChannelAccess', channelId, discordUserId, reason)
        return { hasAccess: false, reason }
      }

      const permissions = (channel as GuildChannel).permissionsFor(member)
      if (!permissions?.has(PermissionsBitField.Flags.ViewChannel)) {
        const reason = 'User lacks permission to view channel'
        this.warnAccessRejection('verifyChannelAccess', channelId, discordUserId, reason)
        return { hasAccess: false, reason }
      }

      return { hasAccess: true }
    } catch (error) {
      this.logger.error(
        `verifyChannelAccess failed: targetId=${channelId}, userId=${discordUserId}, reason=Discord API error: ${this.getErrorMessage(error)}`
      )
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
        const reason = 'Guild not found'
        this.warnAccessRejection('verifyGuildAccess', guildId, discordUserId, reason)
        return { hasAccess: false, reason }
      }

      const member = await guild.members.fetch(discordUserId)
      if (!member) {
        const reason = 'User is not a member of the guild'
        this.warnAccessRejection('verifyGuildAccess', guildId, discordUserId, reason)
        return { hasAccess: false, reason }
      }

      return { hasAccess: true }
    } catch (error) {
      this.logger.error(
        `verifyGuildAccess failed: targetId=${guildId}, userId=${discordUserId}, reason=Discord API error: ${this.getErrorMessage(error)}`
      )
      return { hasAccess: false, reason: 'Error verifying access' }
    }
  }

  /**
   * ギルドのチャンネル管理権限検証
   *
   * Discord API例外は上位の既存認可境界で処理するため、ここでは権限なしへ変換しない。
   *
   * requestedOverwritePermissionKeys の契約:
   * - undefined … 非空の permission overwrite 指定なし。従来どおり ManageChannels のみ要求。
   * - 配列（空を含む）… 非空 overwrite あり。Discord ネイティブの overwrite 編集意味論に合わせ、
   *   さらに ManageRoles と各キーの保持（caller-holds）を要求する。
   */
  async verifyGuildManagePermission(
    client: Client,
    guildId: string,
    discordUserId: string,
    parentId?: string,
    requestedOverwritePermissionKeys?: readonly PermissionsString[]
  ): Promise<GuildManagePermissionCheckResult> {
    try {
      const guild = await client.guilds.fetch(guildId)
      if (!guild) {
        return this.denyManagePermission('permission-denied', 'Guild not found', guildId, discordUserId)
      }

      const member = await guild.members.fetch(discordUserId)
      if (!member) {
        return this.denyManagePermission(
          'permission-denied',
          'User is not a member of the guild',
          guildId,
          discordUserId
        )
      }

      if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return this.denyManagePermission(
          'permission-denied',
          'User lacks permission to manage channels',
          guildId,
          discordUserId
        )
      }

      // Why: Discord 本来はカテゴリ overwrite だけで管理を許す構成もあり得るが、ここは Bot による
      // 代理作成のため「基底 ManageRoles AND カテゴリ ManageRoles」を要求する意図的な過剰制限。
      if (
        requestedOverwritePermissionKeys !== undefined &&
        !member.permissions.has(PermissionsBitField.Flags.ManageRoles)
      ) {
        return this.denyManagePermission(
          'permission-denied',
          'User lacks permission to manage roles',
          guildId,
          discordUserId
        )
      }

      // 非空 overwrite の caller-holds は parent 指定時はカテゴリ実効権限、なしは guild 基底権限で判定する
      let effectivePermissions: Pick<PermissionsBitField, 'has'> = member.permissions

      if (parentId) {
        let parent: GuildBasedChannel
        try {
          // External contract: guild.channels.fetch は失敗時に null ではなく throw する。
          // discord.js の nullable 型だけを `!` で狭め、not-found 分類は下の catch のエラーコード判定へ一本化する。
          // Invariant: Unknown Channel(10003) / GuildChannelUnowned を parent-not-found（入力不正）と
          // 分類してよいのはこの fetch だけ。guilds.fetch / members.fetch 由来の同コードは基盤障害として伝播する。
          parent = (await guild.channels.fetch(parentId))!
        } catch (error) {
          if (this.isUnknownParentChannelError(error)) {
            return this.denyManagePermission('parent-not-found', 'Parent category not found', parentId, discordUserId)
          }
          throw error
        }

        if (parent.type !== ChannelType.GuildCategory) {
          return this.denyManagePermission(
            'parent-not-category',
            'Parent channel is not a category',
            parentId,
            discordUserId
          )
        }

        // Why: Discord 本来はカテゴリ overwrite だけで管理を許す構成もあり得るが、ここは Bot による
        // 代理作成のため「基底 ManageChannels AND カテゴリ ManageChannels」を要求する意図的な過剰制限。
        const parentPermissions = parent.permissionsFor(member)
        if (!parentPermissions?.has(PermissionsBitField.Flags.ManageChannels)) {
          return this.denyManagePermission(
            'permission-denied',
            'User lacks permission to manage channels in parent category',
            parentId,
            discordUserId
          )
        }

        if (
          requestedOverwritePermissionKeys !== undefined &&
          !parentPermissions.has(PermissionsBitField.Flags.ManageRoles)
        ) {
          return this.denyManagePermission(
            'permission-denied',
            'User lacks permission to manage roles in parent category',
            parentId,
            discordUserId
          )
        }

        effectivePermissions = parentPermissions
      }

      if (requestedOverwritePermissionKeys !== undefined) {
        const denied = this.denyIfLacksRequestedOverwritePermissions(
          effectivePermissions,
          requestedOverwritePermissionKeys,
          parentId ?? guildId,
          discordUserId
        )
        if (denied) {
          return denied
        }
      }

      return { hasPermission: true }
    } catch (error) {
      this.logger.error(
        `verifyGuildManagePermission failed: targetId=${parentId ?? guildId}, userId=${discordUserId}, reason=Discord API error: ${this.getErrorMessage(error)}`
      )
      throw error
    }
  }

  /**
   * 非空 overwrite の要求キー（allow/deny の和集合）を呼出者が保持しているか検証する。
   * PermissionsBitField.has を経由するため Administrator の暗黙包含は有効のまま。
   * Flags に実在しないキーは fail-closed で不足扱いにし、warn/reason へは検証済みキー名だけを出す。
   */
  private denyIfLacksRequestedOverwritePermissions(
    permissions: Pick<PermissionsBitField, 'has'>,
    requestedKeys: readonly PermissionsString[],
    targetId: string,
    discordUserId: string
  ): GuildManagePermissionCheckResult | undefined {
    const resolveFlag = (key: PermissionsString): bigint | undefined =>
      Object.prototype.hasOwnProperty.call(PermissionsBitField.Flags, key) ? PermissionsBitField.Flags[key] : undefined

    const missingKeys = [...new Set(requestedKeys)].filter((key) => {
      const flag = resolveFlag(key)
      return flag === undefined || !permissions.has(flag)
    })
    if (missingKeys.length === 0) {
      return undefined
    }

    const validatedMissingKeys = missingKeys.filter((key) => resolveFlag(key) !== undefined)
    return this.denyManagePermission(
      'permission-denied',
      `User lacks requested overwrite permissions: ${validatedMissingKeys.join(', ')}`,
      targetId,
      discordUserId
    )
  }

  private denyManagePermission(
    denial: GuildManagePermissionDenial,
    reason: string,
    targetId: string,
    discordUserId: string
  ): GuildManagePermissionCheckResult {
    this.warnAccessRejection('verifyGuildManagePermission', targetId, discordUserId, reason)
    return { hasPermission: false, denial, reason }
  }

  /** 判定の正本は discord.js のエラーコード enum（数値・文字列の直書きを避ける） */
  private isUnknownParentChannelError(error: unknown): boolean {
    const code = (error as { code?: unknown } | null)?.code
    return code === RESTJSONErrorCodes.UnknownChannel || code === DiscordjsErrorCodes.GuildChannelUnowned
  }

  private warnAccessRejection(operation: string, targetId: string, discordUserId: string, reason: string): void {
    this.logger.warn(`${operation} rejected: targetId=${targetId}, userId=${discordUserId}, reason=${reason}`)
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
