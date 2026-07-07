import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventHandler, EventContext } from 'events/handlers/_shared/event-handler.base'
import { CharacterUIService } from 'discord/features/characterEdit/services/character-ui.service'
import { CharacterEmbedManagerService } from 'discord/features/characterEdit/services/character-embed-manager.service'
import { DiscordClientService } from 'discord/services/discord-client.service'
import { CharacterCreationCompletedEvent } from 'events/contracts/unified-event-contracts'
import { EVENT_NAMES } from 'events/contracts'
import { TextChannel } from 'discord.js'
import { TypedEventService } from 'src/core/events/typed-event.service'

/**
 * character.creation.completed 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター作成完了時のDiscord UI更新
 * - チャンネルEmbedの更新
 * - 作成完了通知の送信
 * - チャンネル名同期（Channel Orchestrator機能統合）
 *
 * 🏗️ 登録方式:
 * - discord 層へ移設し、OnModuleInit で TypedEventService に自己購読する
 *   （旧: events 層の EventRegistryService による集中登録）
 * - EventHandler 基底の execute()（検証・ログ・統計・リトライ）は維持
 */
@Injectable()
export class CharacterCreationCompletedHandler
  extends EventHandler<CharacterCreationCompletedEvent>
  implements OnModuleInit
{
  constructor(
    private readonly characterUIService: CharacterUIService,
    private readonly embedManager: CharacterEmbedManagerService,
    private readonly discordClientService: DiscordClientService,
    private readonly typedEventServiceLocal: TypedEventService
  ) {
    super()
  }

  /**
   * モジュール初期化: TypedEventService への自己購読
   */
  onModuleInit(): void {
    this.setTypedEventService(this.typedEventServiceLocal)
    this.typedEventServiceLocal.on(this.getEventName(), (event) => this.execute(event))
  }

  /**
   * 処理するイベント名
   * 注: 契約リテラル型で返す（TypedEventService.on の厳密 EventName 型に適合させるため）
   */
  getEventName(): 'character.creation.completed' {
    return EVENT_NAMES.CHARACTER_CREATION_COMPLETED
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterCreationCompletedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🎭 Processing character creation completed: ${event.character.characterName}`)

    try {
      // 1. Discord UI更新処理
      await this.updateDiscordUI(event, context)

      // 2. 統合通知処理（TypedEventService 経由の生フロー発行）
      await this.processIntegratedNotifications(event)

      this.logger.log(`✅ Character creation completed processing finished: ${event.character.characterId}`)
    } catch (error) {
      this.logger.error(
        `❌ Character creation completed processing failed: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * Discord UI更新処理
   */
  private async updateDiscordUI(event: CharacterCreationCompletedEvent, _context?: EventContext): Promise<void> {
    const { character } = event

    // 0. チャンネル名の同期（Channel Orchestrator機能統合）
    if (character.discordChannelId) {
      await this.syncChannelNameWithCharacter(character.discordChannelId, character.characterName)
    }

    // 1. チャンネルが存在する場合、セレクトメニュー付きEmbedを作成
    if (character.discordChannelId) {
      this.logger.debug(`Creating sectioned embeds in channel: ${character.discordChannelId}`)

      try {
        // EmbedManagerを使用してセクション分割されたEmbed+セレクトメニューを作成
        const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)

        const client = this.discordClientService.getClient()
        if (!client) {
          throw new Error('Discord client not available')
        }

        const channel = await client.channels.fetch(character.discordChannelId)
        if (!channel || !channel.isTextBased()) {
          throw new Error('Invalid channel')
        }

        await (channel as TextChannel).send({
          embeds,
          components
        })

        this.logger.debug(`✅ Sectioned character embeds created successfully`)
      } catch (error) {
        this.logger.warn(
          `⚠️ Character embed creation failed: ${error instanceof Error ? error.message : String(error)}`
        )
        // Embed作成の失敗は致命的ではないため、処理を続行
      }
    }
  }

  /**
   * 統合通知処理（TypedEventService 経由の生フロー発行）
   */
  private async processIntegratedNotifications(event: CharacterCreationCompletedEvent): Promise<void> {
    const { character } = event

    try {
      // 1. Discord統合通知イベント発行
      if (character.discordChannelId) {
        await this.typedEventServiceLocal.emit(EVENT_NAMES.DISCORD_NOTIFICATION_REQUESTED, {
          timestamp: new Date(),
          source: 'system',
          channelId: character.discordChannelId,
          notification: {
            type: 'character.created',
            channelId: character.discordChannelId,
            title: '🎭 キャラクター作成完了',
            message: `キャラクター「${character.characterName}」が作成されました。`,
            color: 0x00ff00,
            characterId: character.characterId
          }
        })
      }

      // 2. スレッド作成リクエスト（discordChannelId 基準。E-6a: deprecated threadId 条件と
      //    「threadId のみのとき channelId 空文字で emit する」旧挙動は bugfix として廃止）
      if (character.discordChannelId) {
        await this.typedEventServiceLocal.emit(EVENT_NAMES.DISCORD_THREAD_CREATE_REQUESTED, {
          character,
          channelId: character.discordChannelId,
          guildId: 'default-guild', // Channel Create Orchestratorで実際のguildIdに更新される
          creatorId: character.discordUserId || 'system',
          displayType: 'enhanced',
          source: 'character-creation-completed-handler',
          timestamp: new Date()
        })
      }

      // 3. Embed更新リクエスト
      if (character.discordChannelId) {
        await this.typedEventServiceLocal.emit(EVENT_NAMES.DISCORD_EMBED_UPDATE_REQUESTED, {
          timestamp: new Date(),
          source: 'system',
          channelId: character.discordChannelId,
          embedData: {
            channelId: character.discordChannelId,
            characterId: character.characterId,
            embedType: 'character',
            updateMode: 'create'
          }
        })
      }
      // E-6c: キャラクター表示リクエストイベント（旧 display.requested 契約）の emit を撤去
      // （購読側 2 サービスは E-3d でゴースト化済み＝観測可能な効果ゼロ。契約ごと削除）

      this.logger.log(`✅ Integrated notifications processed: ${character.characterId}`)
    } catch (error) {
      this.logger.error(`❌ Integrated notifications failed: ${character.characterId}`, error)
    }
  }

  /**
   * リトライ可能エラーの判定
   */
  protected isRetryableError(error: Error): boolean {
    // Discord API関連のエラーはリトライ可能
    if (error.message.includes('Discord') || error.message.includes('API')) {
      return true
    }

    return super.isRetryableError(error)
  }

  /**
   * 最大リトライ回数
   */
  protected getMaxRetries(): number {
    return 2 // Discord API呼び出しのため控えめに設定
  }

  /**
   * チャンネル名をキャラクター名に同期（Channel Orchestrator機能統合）
   */
  private async syncChannelNameWithCharacter(channelId: string, characterName: string): Promise<void> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        this.logger.warn('Discord client not available for channel name sync')
        return
      }

      const channel = await client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(`チャンネルが見つかりません: ${channelId}`)
        return
      }

      const textChannel = channel as TextChannel
      const sanitizedChannelName = this.sanitizeChannelName(characterName)

      if (textChannel.name !== sanitizedChannelName) {
        await textChannel.setName(sanitizedChannelName, `キャラクター名を反映: ${characterName}`)
        this.logger.log(`チャンネル名をキャラクター名に同期しました: ${characterName} → ${sanitizedChannelName}`)
      } else {
        this.logger.debug(`チャンネル名は既に同期済み: ${sanitizedChannelName}`)
      }
    } catch (error) {
      this.logger.warn(`チャンネル名の同期に失敗しました: ${characterName}`, error)
      // チャンネル名の同期失敗は致命的ではないため、エラーを再スローしない
    }
  }

  /**
   * チャンネル名をDiscordの制約に合わせてサニタイズ
   */
  private sanitizeChannelName(characterName: string): string {
    // Discordチャンネル名の制約:
    // - 2-100文字
    // - 小文字、数字、ハイフン、アンダースコア、日本語のみ
    // - スペースは使用不可
    let sanitized = characterName
      .toLowerCase()
      .replace(/\s+/g, '-') // スペースをハイフンに変換
      .replace(/[^\w\-ぁ-んァ-ヶー一-龯]/g, '') // 無効文字を除去
      .slice(0, 100) // 最大100文字

    // 最低2文字必要
    if (sanitized.length < 2) {
      sanitized = `character-${sanitized}`.slice(0, 100)
    }

    // ハイフンで開始・終了することはできない
    sanitized = sanitized.replace(/^-+|-+$/g, '')
    if (sanitized.length < 2) {
      sanitized = 'character'
    }

    return sanitized
  }
}
