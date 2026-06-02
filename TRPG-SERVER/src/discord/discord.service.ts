import { Injectable, Logger } from '@nestjs/common'
import { Client } from 'discord.js'
import { DiscordFacadeService } from './discord-facade.service'
import { SendMessageDto } from './dto/send-message.dto'
import { CreateChannelDto } from './dto/create-channel.dto'
import { Character } from '../domains/character/models/character.model'

// Legacy型定義（後方互換性のため保持）
interface GuildInfo {
  id: string
  name: string
  memberCount: number
  channels: Array<{ id: string; name: string; type: string }>
}

/**
 * Discord統合サービス
 *
 * 【重要】このクラスは後方互換性のために残されています
 * 新しい実装ではDiscordFacadeServiceを使用してください
 *
 * features/アーキテクチャ準拠の薄いラッパー
 */
@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name)

  constructor(private readonly discordFacade: DiscordFacadeService) {
    this.logger.warn('DiscordService is deprecated. Please use DiscordFacadeService instead.')
  }

  /**
   * Discordサービスを初期化する
   * @deprecated Use DiscordFacadeService.initializeDiscord() instead
   */
  async initializeDiscord(): Promise<void> {
    return this.discordFacade.initializeDiscord()
  }

  // 【廃止予定】インタラクション登録メソッド
  // 新しい実装ではfeatures/のAdapterパターンを使用してください

  /**
   * ユーザーのチャンネルアクセス権限を確認
   * @deprecated Use DiscordFacadeService.verifyChannelAccess() instead
   */
  async verifyChannelAccess(channelId: string, discordUserId: string): Promise<boolean> {
    return this.discordFacade.verifyChannelAccess(channelId, discordUserId)
  }

  /**
   * ユーザーのギルドアクセス権限を確認
   * @deprecated Use DiscordFacadeService.verifyGuildAccess() instead
   */
  async verifyGuildAccess(guildId: string, discordUserId: string): Promise<boolean> {
    return this.discordFacade.verifyGuildAccess(guildId, discordUserId)
  }

  /**
   * メッセージを送信する
   * @deprecated Use DiscordFacadeService.sendMessage() instead
   */
  async sendMessage(sendMessageDto: SendMessageDto): Promise<any> {
    return this.discordFacade.sendMessage(sendMessageDto.channelId, sendMessageDto.content || '', {
      embeds: sendMessageDto.embeds,
      components: sendMessageDto.components
    })
  }

  /**
   * チャンネルを作成する
   * @deprecated Use DiscordFacadeService.createChannel() instead
   */
  async createChannel(createChannelDto: CreateChannelDto): Promise<any> {
    return this.discordFacade.createChannel(createChannelDto.guildId, createChannelDto.name, {
      type: createChannelDto.type,
      parent: createChannelDto.parentId,
      topic: createChannelDto.topic,
      permissions: createChannelDto.permissions
    })
  }

  /**
   * ギルド情報を取得する
   * @deprecated Use DiscordFacadeService.getGuildInfo() instead
   */
  async getGuildInfo(guildId: string): Promise<GuildInfo> {
    return this.discordFacade.getGuildInfo(guildId)
  }

  /**
   * チャンネル情報を取得する
   * @deprecated Use DiscordFacadeService.getChannelInfo() instead
   */
  async getChannelInfo(channelId: string): Promise<{
    id: string
    name: string
    type: string
    guild: { id: string; name: string }
  }> {
    const result = await this.discordFacade.getChannelInfo(channelId)
    if (!result) {
      throw new Error(`Channel not found: ${channelId}`)
    }
    return result
  }

  /**
   * Client インスタンスを取得する
   * @deprecated Use DiscordFacadeService.getClient() instead
   */
  getClient(): Client {
    return this.discordFacade.getClient()
  }

  /**
   * サービスの初期化状態を取得する
   * @deprecated Use DiscordFacadeService.isInitialized() instead
   */
  isInitialized(): boolean {
    return this.discordFacade.isInitialized()
  }

  /**
   * パフォーマンス統計取得
   * @deprecated Use DiscordFacadeService.getPerformanceStats() instead
   */
  getPerformanceStats() {
    return this.discordFacade.getPerformanceStats()
  }

  /**
   * ヘルスチェック
   * @deprecated Use DiscordFacadeService.getHealthStatus() instead
   */
  getHealthStatus() {
    return this.discordFacade.getHealthStatus()
  }

  // 【廃止予定】以下のメソッドは新しいアーキテクチャでは使用されません
  // 必要に応じてfeatures/内の適切なOrchestratorまたはAdapterを使用してください

  /**
   * @deprecated This method is no longer supported. Use features/ architecture instead.
   */
  async getBotStatus(): Promise<{
    online: boolean
    guilds: number
    users: number
    ping: number
    uptime: number
  }> {
    this.logger.warn('getBotStatus is deprecated. Use health check methods instead.')
    const health = this.discordFacade.getHealthStatus()
    const client = this.discordFacade.getClient()

    return {
      online: health.services.client,
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      ping: client.ws.ping,
      uptime: client.uptime || 0
    }
  }

  /**
   * @deprecated Character-specific functionality moved to features/characterEdit/ and features/characterThread/
   */
  async createCharacterEmbed(_character: Character, _guildId: string): Promise<any> {
    this.logger.error(
      'createCharacterEmbed is deprecated. Use features/characterThread/ or features/characterEdit/ instead.'
    )
    throw new Error('Method deprecated. Use features/ architecture instead.')
  }

  /**
   * @deprecated Use features/characterThread/CharacterDisplayService instead
   */
  async createOrUpdateCharacterEmbed(_character: Character, _channelId: string, _guildInfo?: any): Promise<any> {
    this.logger.error(
      'createOrUpdateCharacterEmbed is deprecated. Use CharacterDisplayService in features/characterThread/ instead.'
    )
    throw new Error('Method deprecated. Use CharacterDisplayService instead.')
  }

  /**
   * @deprecated Guild permission checks moved to DiscordGuildManagerService
   */
  async verifyGuildManagePermission(guildId: string, userId: string): Promise<boolean> {
    this.logger.error(
      'verifyGuildManagePermission is deprecated. Use DiscordGuildManagerService.verifyGuildAccess instead.'
    )
    try {
      const result = await this.discordFacade.verifyGuildAccess(guildId, userId)
      return result
    } catch (error) {
      this.logger.error('Error verifying guild permission:', error)
      return false
    }
  }
}
