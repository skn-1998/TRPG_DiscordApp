import { Injectable, Logger } from '@nestjs/common'
import { Client, TextChannel, ThreadChannel, ChannelType, ThreadAutoArchiveDuration } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { DiscordClientService } from '../../../services/discord-client.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { buildThreadUrl, nextBackoffDelay, buildCreationCompletedPayload } from './thread-manager.util'

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
   * 現在時刻（ミリ秒）を返す seam。
   * 本番は Date.now をそのまま使うが、テストでは差し替えて poll ループや
   * タイミングログを決定的にできる（本番のタイミング挙動は不変）。
   */
  protected now(): number {
    return Date.now()
  }

  /**
   * 指定ミリ秒だけ待機する seam。
   * 本番は setTimeout による実待機。テストでは 0 遅延フェイクに差し替えて
   * テストを遅延させない（本番の待機時間自体は不変）。
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * キャラクター用スレッドを作成
   */
  async createCharacterThread(request: CreateThreadRequest, _character: Character): Promise<CreateThreadResult> {
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

      const textChannel = channel
      const thread = await this.createDiscordThread(textChannel, request.characterName)

      const threadUrl = buildThreadUrl(request.guildId, thread.id)

      // スレッド作成完了イベントを発行
      await this.typedEventService.emit(
        'character-thread.creation.completed',
        buildCreationCompletedPayload(
          {
            threadId: thread.id,
            characterId: request.characterId,
            characterName: request.characterName,
            channelId: request.channelId,
            creatorId: request.creatorId,
            guildId: request.guildId
          },
          threadUrl,
          new Date()
        )
      )

      this.logger.log(`Thread created successfully: ${thread.id}`)

      return {
        success: true,
        threadId: thread.id,
        threadUrl
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to create thread: ${errorMessage}`, error)

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
    this.logger.log(`[THREAD-CREATE] Creating thread in channel: ${channel.id} for character: ${characterName}`)
    this.logger.log(
      `[THREAD-CREATE] Channel permissions: ${JSON.stringify(channel.permissionsFor(this.discordClient.user!)?.toArray() || [])}`
    )

    try {
      const startTime = this.now()

      // Discord APIコール実行
      const thread = await channel.threads.create({
        name: `🎭${characterName}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        type: ChannelType.PublicThread,
        reason: `Character thread for ${characterName}`
      })

      const apiResponseTime = this.now() - startTime

      // 実験: ログなしでの即座検証
      const immediateVerifyStart = this.now()
      const immediateThread = await this.discordClient.channels.fetch(thread.id)
      const immediateVerifyTime = this.now() - immediateVerifyStart

      this.logger.log(`[THREAD-CREATE] ===== API Response Analysis =====`)
      this.logger.log(`[THREAD-CREATE] API response time: ${apiResponseTime}ms`)
      this.logger.log(`[THREAD-CREATE] Immediate fetch time: ${immediateVerifyTime}ms`)
      this.logger.log(`[THREAD-CREATE] Thread created: ${!!thread}`)
      this.logger.log(`[THREAD-CREATE] Thread immediately fetchable: ${!!immediateThread}`)
      this.logger.log(`[THREAD-CREATE] Thread ID: ${thread.id}`)
      this.logger.log(`[THREAD-CREATE] Thread name: ${thread.name}`)
      this.logger.log(`[THREAD-CREATE] Thread type: ${thread.type}`)
      this.logger.log(`[THREAD-CREATE] Thread archived: ${thread.archived}`)
      this.logger.log(`[THREAD-CREATE] Thread parent ID: ${thread.parentId}`)
      this.logger.log(`[THREAD-CREATE] Thread member count: ${thread.memberCount}`)
      this.logger.log(`[THREAD-CREATE] ================================`)

      // 実験: 明示的待機での検証
      this.logger.log(`[THREAD-CREATE] Testing explicit wait strategy...`)
      await this.sleep(50)
      const delayedThread = await this.discordClient.channels.fetch(thread.id)
      this.logger.log(`[THREAD-CREATE] After 50ms delay fetchable: ${!!delayedThread}`)

      return thread
    } catch (error) {
      this.logger.error(`[THREAD-CREATE] Failed to create Discord thread:`, error)
      this.logger.error(`[THREAD-CREATE] Error details:`, {
        name: (error as any).name,
        message: (error as any).message,
        code: (error as any).code,
        status: (error as any).status
      })
      throw error
    }
  }

  /**
   * スレッドチャンネルを取得（リトライ機構付き）
   */
  async getThreadChannel(threadId: string, retryCount = 3, delayMs = 100): Promise<ThreadChannel | null> {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        this.logger.debug(`[THREAD-FETCH] Attempt ${attempt}/${retryCount} to fetch thread: ${threadId}`)

        const channel = await this.discordClient.channels.fetch(threadId, { force: true })

        if (channel?.isThread()) {
          this.logger.debug(`[THREAD-FETCH] Successfully fetched thread on attempt ${attempt}`)
          return channel
        } else {
          this.logger.warn(`[THREAD-FETCH] Fetched channel is not a thread: ${threadId}`)
          return null
        }
      } catch (error) {
        this.logger.warn(`[THREAD-FETCH] Attempt ${attempt} failed:`, error)

        if (attempt < retryCount) {
          this.logger.debug(`[THREAD-FETCH] Waiting ${delayMs}ms before retry...`)
          await this.sleep(delayMs)
          delayMs = nextBackoffDelay(delayMs) // Exponential backoff
        } else {
          this.logger.error(`[THREAD-FETCH] All ${retryCount} attempts failed for thread: ${threadId}`, error)
          return null
        }
      }
    }

    return null
  }

  /**
   * スレッドの存在確認（ポーリング方式）
   */
  async waitForThreadAvailability(
    threadId: string,
    maxWaitMs = 5000,
    pollIntervalMs = 100
  ): Promise<ThreadChannel | null> {
    const startTime = this.now()
    let attempts = 0

    this.logger.debug(`[THREAD-WAIT] Starting to wait for thread availability: ${threadId}`)

    while (this.now() - startTime < maxWaitMs) {
      attempts++

      try {
        const thread = await this.getThreadChannel(threadId, 1, 0) // Single attempt, no internal retry
        if (thread) {
          this.logger.log(
            `[THREAD-WAIT] Thread became available after ${this.now() - startTime}ms (${attempts} attempts)`
          )
          return thread
        }
      } catch {
        this.logger.debug(`[THREAD-WAIT] Attempt ${attempts} failed, continuing...`)
      }

      await this.sleep(pollIntervalMs)
    }

    this.logger.error(`[THREAD-WAIT] Thread did not become available within ${maxWaitMs}ms after ${attempts} attempts`)
    return null
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
