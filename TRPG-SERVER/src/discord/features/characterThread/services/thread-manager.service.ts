import { Injectable, Logger } from '@nestjs/common'
import { Client, Guild, TextChannel, ThreadChannel, ChannelType, ThreadAutoArchiveDuration } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { ErrorHandler, ErrorContext } from '../../../../utils/error-handler'
import { DiscordClientService } from '../../../services/discord-client.service'
import { TypedEventService } from '../../../../shared/application/typed-event.service'

/**
 * スレッド作成リクエスト
 */
export interface CreateThreadRequest {
  characterId: string
  characterName: string
  channelId: string
  creatorId: string
  guildId: string
  displayType?: 'basic' | 'enhanced' | 'compact'
}

/**
 * スレッド作成結果
 */
export interface CreateThreadResult {
  success: boolean
  threadId?: string
  threadUrl?: string
  error?: string
}

/**
 * スレッド管理サービス
 *
 * 責務：
 * - Discordスレッドの作成・管理
 * - スレッド設定の管理
 * - スレッドライフサイクル管理
 */
@Injectable()
export class ThreadManagerService {
  private readonly logger = new Logger(ThreadManagerService.name)
  private readonly discordClient: Client

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly typedEventService: TypedEventService
  ) {
    this.discordClient = this.discordClientService.getClient()
    this.logger.debug('Thread manager service initialized')
  }

  /**
   * キャラクター用スレッドを作成
   */
  async createCharacterThread(request: CreateThreadRequest, character: Character): Promise<CreateThreadResult> {
    const context: ErrorContext = {
      operation: 'createCharacterThread',
      characterId: request.characterId,
      channelId: request.channelId,
      guildId: request.guildId
    }

    try {
      this.logger.log(`Creating thread for character: ${request.characterName}`)

      const guild = await this.discordClient.guilds.fetch(request.guildId)
      if (!guild) {
        throw new Error(`Guild not found: ${request.guildId}`)
      }

      const channel = await guild.channels.fetch(request.channelId)
      if (!channel || channel.type !== ChannelType.GuildText) {
        throw new Error(`Text channel not found: ${request.channelId}`)
      }

      const textChannel = channel as TextChannel
      const thread = await this.createDiscordThread(textChannel, request.characterName)

      // スレッド作成完了イベントを発行
      await this.typedEventService.emit('character-thread.creation.completed', {
        threadId: thread.id,
        discordThreadId: thread.id,
        threadUrl: `https://discord.com/channels/${request.guildId}/${thread.id}`,
        characterId: request.characterId,
        characterName: request.characterName,
        channelId: request.channelId,
        creatorId: request.creatorId,
        guildId: request.guildId,
        timestamp: new Date(),
        source: 'thread-manager-service'
      })

      this.logger.log(`Thread created successfully: ${thread.id}`)

      return {
        success: true,
        threadId: thread.id,
        threadUrl: `https://discord.com/channels/${request.guildId}/${thread.id}`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to create thread: ${errorMessage}`, error)

      // スレッド作成失敗イベントを発行
      await this.typedEventService.emit('character-thread.creation.failed', {
        threadId: `temp-${Date.now()}`,
        characterId: request.characterId,
        characterName: request.characterName,
        channelId: request.channelId,
        creatorId: request.creatorId,
        guildId: request.guildId,
        error: errorMessage,
        timestamp: new Date(),
        source: 'thread-manager-service'
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Discordスレッドを作成（内部実装）
   */
  private async createDiscordThread(channel: TextChannel, characterName: string): Promise<ThreadChannel> {
    const thread = await channel.threads.create({
      name: `🎭${characterName}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      type: ChannelType.PrivateThread, // プライベートスレッドとして作成
      reason: `Character thread for ${characterName}`
    })

    this.logger.debug(`Discord thread created: ${thread.id}`)
    return thread
  }

  /**
   * スレッドチャンネルを取得
   */
  async getThreadChannel(threadId: string): Promise<ThreadChannel | null> {
    try {
      const channel = await this.discordClient.channels.fetch(threadId)
      return channel?.isThread() ? channel : null
    } catch (error) {
      this.logger.error(`Failed to fetch thread channel: ${threadId}`, error)
      return null
    }
  }

  /**
   * スレッドの存在確認
   */
  async threadExists(threadId: string): Promise<boolean> {
    const thread = await this.getThreadChannel(threadId)
    return thread !== null
  }

  /**
   * スレッドアーカイブ
   */
  async archiveThread(threadId: string): Promise<boolean> {
    try {
      const thread = await this.getThreadChannel(threadId)
      if (!thread) {
        this.logger.warn(`Thread not found for archiving: ${threadId}`)
        return false
      }

      await thread.setArchived(true)
      this.logger.log(`Thread archived: ${threadId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to archive thread: ${threadId}`, error)
      return false
    }
  }

  /**
   * スレッドアンアーカイブ
   */
  async unarchiveThread(threadId: string): Promise<boolean> {
    try {
      const thread = await this.getThreadChannel(threadId)
      if (!thread) {
        this.logger.warn(`Thread not found for unarchiving: ${threadId}`)
        return false
      }

      await thread.setArchived(false)
      this.logger.log(`Thread unarchived: ${threadId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to unarchive thread: ${threadId}`, error)
      return false
    }
  }
}
