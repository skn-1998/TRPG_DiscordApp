import { Injectable } from '@nestjs/common'
import { EventHandler, EventContext } from 'events/handlers/_shared/event-handler.base'
import { CharacterUIService } from 'discord/features/characterEdit/services/character-ui.service'
import { CharacterEmbedManagerService } from 'discord/features/characterEdit/services/character-embed-manager.service'
import { DiscordClientService } from 'discord/services/discord-client.service'
import { CharacterCreationCompletedEvent } from 'events/contracts/unified-event-contracts'
import { TextChannel } from 'discord.js'
import { Character } from 'domains/character/models/character.model'
import { GlobalEventBusService } from 'events/bus/global-event-bus.service'
import { TypedEventService } from 'shared/application/typed-event.service'

/**
 * character.creation.completed 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター作成完了時のDiscord UI更新
 * - チャンネルEmbedの更新
 * - 作成完了通知の送信
 * - チャンネル名同期（Channel Orchestrator機能統合）
 */
@Injectable()
export class CharacterCreationCompletedHandler extends EventHandler<CharacterCreationCompletedEvent> {
  constructor(
    private readonly characterUIService: CharacterUIService,
    private readonly embedManager: CharacterEmbedManagerService,
    private readonly discordClientService: DiscordClientService,
    private readonly globalEventBus: GlobalEventBusService,
    private readonly typedEventServiceLocal: TypedEventService
  ) {
    super()
  }

  /**
   * 処理するイベント名
   */
  getEventName(): string {
    return 'character.creation.completed'
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterCreationCompletedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🎭 Processing character creation completed: ${event.character.characterName}`)

    try {
      // 1. Discord UI更新処理
      await this.updateDiscordUI(event, context)

      // 2. 統合通知・監査処理（旧GlobalEventBus処理を統合）
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
  private async updateDiscordUI(event: CharacterCreationCompletedEvent, context?: EventContext): Promise<void> {
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
        const { embeds, components } = await this.embedManager.createSectionedEmbeds(character as Character)

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
   * 統合通知・監査処理（旧GlobalEventBus処理を統合）
   */
  private async processIntegratedNotifications(event: CharacterCreationCompletedEvent): Promise<void> {
    const { character } = event

    try {
      // 1. Discord統合通知イベント発行
      if (character.discordChannelId) {
        await this.typedEventServiceLocal.emit('discord.notification.requested', {
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

      // 2. スレッド作成リクエスト（threadIdが指定されている場合）
      if (character.threadId || character.discordChannelId) {
        await this.typedEventServiceLocal.emit('discord.thread.create.requested', {
          character: character as Character,
          channelId: character.discordChannelId || '',
          guildId: 'default-guild', // Channel Create Orchestratorで実際のguildIdに更新される
          creatorId: character.discordUserId || 'system',
          displayType: 'enhanced',
          source: 'character-creation-completed-handler',
          timestamp: new Date()
        })
      }

      // 3. Embed更新リクエスト
      if (character.discordChannelId) {
        await this.typedEventServiceLocal.emit('discord.embed.update.requested', {
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

        // CharacterEdit Enhanced Embed作成リクエスト（TypedEventService経由）
        await this.typedEventServiceLocal.emit('discord.character.display.requested', {
          character: {
            ...character,
            discordChannelId: character.discordChannelId // 確実に存在するためNon-null assertion
          } as Character,
          channelId: character.discordChannelId,
          guildId: 'default-guild', // Channel Create Orchestratorで実際のguildIdに更新される
          requesterId: character.discordUserId || 'system',
          displayType: 'enhanced',
          source: 'character-creation-completed-handler',
          timestamp: new Date()
        })

        this.logger.log(`🎨 CharacterEdit Enhanced Embed requested: ${character.characterId}`)
      }

      // 4. システム監査ログ
      await this.globalEventBus.emit({
        type: 'system.audit.logged',
        timestamp: new Date(),
        source: 'system',
        audit: {
          action: 'character.created',
          userId: character.discordUserId,
          resource: `character:${character.characterId}`,
          details: {
            characterName: character.characterName,
            gameSystemId: character.gameSystemId,
            source: event.source
          },
          outcome: 'success'
        }
      })

      this.logger.log(`✅ Integrated notifications processed: ${character.characterId}`)
    } catch (error) {
      this.logger.error(`❌ Integrated notifications failed: ${character.characterId}`, error)

      // エラーイベント発行
      await this.globalEventBus.emit({
        type: 'system.error.occurred',
        timestamp: new Date(),
        source: 'system',
        error: {
          code: 'CHARACTER_CREATION_NOTIFICATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          context: { characterId: character.characterId, eventType: 'character.creation.completed' },
          severity: 'medium'
        }
      })
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
