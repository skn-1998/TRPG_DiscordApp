import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ChannelType } from 'discord.js'
import { EventBusService } from '../../shared/application/event-bus.service'
import { DiscordUIService } from '../services/discord-ui.service'
import {
  CharacterUpdateRequested,
  CharacterCreationRequested,
  CharacterDeletionRequested,
  CharacterSearchRequested,
  CharacterUpdated,
  CharacterCreated,
  CharacterDeleted,
  CharacterNotFound,
  CharacterValidationFailed,
  CharacterUpdateFailed,
  CharacterCreationFailed,
  CharacterDeletionFailed,
  CharacterAccessDenied,
  CharacterLimitExceeded,
  CharacterDiscordIntegrationEvent
} from '../../domains/character/events/character.events'
import { CreateCharacterDto } from '../../domains/character/dto/create-character.dto'
import { UpdateCharacterDto } from '../../domains/character/dto/update-character.dto'
import { Character } from '../../domains/character/models/character.model'

/**
 * Discord統合サービス
 * ドメインイベントを受信してDiscord UIの更新を行う
 */
@Injectable()
export class DiscordIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(DiscordIntegrationService.name)

  constructor(
    private readonly eventBus: EventBusService,
    private readonly discordUIService: DiscordUIService
  ) {}

  /**
   * モジュール初期化時にイベントハンドラーを登録
   */
  async onModuleInit(): Promise<void> {
    this.registerEventHandlers()
    this.logger.log('Discord Integration Service initialized and event handlers registered')
  }

  /**
   * イベントハンドラーを登録
   */
  private registerEventHandlers(): void {
    // Character成功イベントハンドラー
    this.eventBus.subscribe('character.updated', { handle: this.handleCharacterUpdated.bind(this) })
    this.eventBus.subscribe('character.created', { handle: this.handleCharacterCreated.bind(this) })
    this.eventBus.subscribe('character.deleted', { handle: this.handleCharacterDeleted.bind(this) })

    // Characterエラーイベントハンドラー
    this.eventBus.subscribe('character.notFound', { handle: this.handleCharacterNotFound.bind(this) })
    this.eventBus.subscribe('character.validationFailed', { handle: this.handleCharacterValidationFailed.bind(this) })
    this.eventBus.subscribe('character.updateFailed', { handle: this.handleCharacterUpdateFailed.bind(this) })
    this.eventBus.subscribe('character.creationFailed', { handle: this.handleCharacterCreationFailed.bind(this) })
    this.eventBus.subscribe('character.deletionFailed', { handle: this.handleCharacterDeletionFailed.bind(this) })
    this.eventBus.subscribe('character.accessDenied', { handle: this.handleCharacterAccessDenied.bind(this) })
    this.eventBus.subscribe('character.limitExceeded', { handle: this.handleCharacterLimitExceeded.bind(this) })

    this.logger.debug('Event handlers registered for Discord integration')
  }

  // === リクエストメソッド ===

  /**
   * キャラクター更新リクエスト
   */
  async requestCharacterUpdate(channelId: string, updateData: UpdateCharacterDto, userId?: string): Promise<void> {
    this.logger.debug(`Character update requested for channel: ${channelId}`)

    await this.eventBus.publish(new CharacterUpdateRequested(channelId, updateData, 'discord' as const, userId))
  }

  /**
   * キャラクター作成リクエスト
   */
  async requestCharacterCreation(createData: CreateCharacterDto, userId: string): Promise<void> {
    this.logger.debug(`Character creation requested by user: ${userId}`)

    await this.eventBus.publish(new CharacterCreationRequested(createData, 'discord' as const, userId))
  }

  /**
   * キャラクター削除リクエスト
   */
  async requestCharacterDeletion(characterId: string, userId: string, reason?: string): Promise<void> {
    this.logger.debug(`Character deletion requested: ${characterId}`)

    await this.eventBus.publish(new CharacterDeletionRequested(characterId, 'discord', userId, reason))
  }

  /**
   * キャラクター検索リクエスト
   */
  async requestCharacterSearch(
    searchCriteria: {
      characterId?: string
      channelId?: string
      characterName?: string
      userId?: string
    },
    source: 'discord' | 'web' | 'api' = 'discord'
  ): Promise<void> {
    this.logger.debug(`Character search requested:`, searchCriteria)

    await this.eventBus.publish(new CharacterSearchRequested(searchCriteria, source))
  }

  // === イベントハンドラー ===

  /**
   * キャラクター更新成功時のDiscord UI更新
   */
  async handleCharacterUpdated(event: CharacterUpdated): Promise<void> {
    try {
      const guildInfo = { id: 'default', name: 'TRPG Server', memberCount: 0, channels: [] }

      await this.discordUIService.createOrUpdateCharacterEmbed(
        event.character,
        event.character.discordChannelId,
        guildInfo
      )

      this.logger.debug(`Character embed updated for channel: ${event.character.discordChannelId}`)
    } catch (error) {
      this.logger.error('Failed to update character embed:', error)
    }
  }

  /**
   * キャラクター作成成功時のDiscord UI更新
   */
  async handleCharacterCreated(event: CharacterCreated): Promise<void> {
    try {
      const guildInfo = { id: 'default', name: 'TRPG Server', memberCount: 0, channels: [] }

      await this.discordUIService.createOrUpdateCharacterEmbed(
        event.character,
        event.character.discordChannelId,
        guildInfo
      )

      // 新規キャラクター用のチャンネル作成（必要に応じて）
      if (!event.character.discordChannelId) {
        const channelResult = await this.discordUIService.createChannel({
          name: `character-${event.character.characterName}`,
          guildId: guildInfo.id,
          topic: `${event.character.characterName}のキャラクターチャンネル`
        })

        if (channelResult.success && channelResult.channelId) {
          // チャンネル作成成功後、新しいチャンネルにEmbedを作成
          await this.discordUIService.createOrUpdateCharacterEmbed(event.character, channelResult.channelId, guildInfo)
        }
      }

      this.logger.debug(`Character created and embed updated: ${event.character.characterName}`)
    } catch (error) {
      this.logger.error('Failed to handle character creation:', error)
    }
  }

  /**
   * キャラクター削除成功時のDiscord UI更新
   */
  async handleCharacterDeleted(event: CharacterDeleted): Promise<void> {
    try {
      // 削除通知メッセージを送信
      await this.discordUIService.sendMessage({
        channelId: event.deletedCharacterData.discordChannelId,
        content: `🗑️ キャラクター「${event.deletedCharacterData.characterName}」が削除されました。`,
        ephemeral: false
      })

      this.logger.debug(`Character deletion notification sent: ${event.deletedCharacterData.characterName}`)
    } catch (error) {
      this.logger.error('Failed to send character deletion notification:', error)
    }
  }

  /**
   * キャラクター検索失敗時の処理
   */
  async handleCharacterNotFound(event: CharacterNotFound): Promise<void> {
    try {
      const channelId = event.searchCriteria.channelId || 'default'
      await this.discordUIService.sendMessage({
        channelId,
        content: '❌ 指定されたキャラクターが見つかりませんでした。',
        ephemeral: true
      })
    } catch (error) {
      this.logger.error('Failed to send character not found message:', error)
    }
  }

  /**
   * バリデーション失敗時の処理
   */
  async handleCharacterValidationFailed(event: CharacterValidationFailed): Promise<void> {
    try {
      await this.discordUIService.sendMessage({
        channelId: 'default', // イベントにchannelId情報がないため
        content: `❌ 入力データが無効です: ${event.validationErrors.join(', ')}`,
        ephemeral: true
      })
    } catch (error) {
      this.logger.error('Failed to send validation error message:', error)
    }
  }

  /**
   * キャラクター更新失敗時の処理
   */
  async handleCharacterUpdateFailed(event: CharacterUpdateFailed): Promise<void> {
    try {
      await this.discordUIService.sendMessage({
        channelId: event.channelId || 'default',
        content: `❌ キャラクター更新に失敗しました: ${event.getErrorMessage()}`,
        ephemeral: true
      })
    } catch (error) {
      this.logger.error('Failed to send update failed message:', error)
    }
  }

  /**
   * キャラクター作成失敗時の処理
   */
  async handleCharacterCreationFailed(event: CharacterCreationFailed): Promise<void> {
    try {
      await this.discordUIService.sendMessage({
        channelId: 'default', // イベントにchannelId情報がないため
        content: `❌ キャラクター作成に失敗しました: ${event.getErrorMessage()}`,
        ephemeral: true
      })
    } catch (error) {
      this.logger.error('Failed to send creation failed message:', error)
    }
  }

  /**
   * キャラクター削除失敗時の処理
   */
  async handleCharacterDeletionFailed(event: CharacterDeletionFailed): Promise<void> {
    try {
      await this.discordUIService.sendMessage({
        channelId: 'default', // イベントにchannelId情報がないため
        content: `❌ キャラクター削除に失敗しました: ${event.getErrorMessage()}`,
        ephemeral: true
      })
    } catch (error) {
      this.logger.error('Failed to send deletion failed message:', error)
    }
  }

  /**
   * アクセス拒否時の処理
   */
  async handleCharacterAccessDenied(event: CharacterAccessDenied): Promise<void> {
    try {
      await this.discordUIService.sendMessage({
        channelId: 'default', // イベントにchannelId情報がないため
        content: '🚫 この操作を実行する権限がありません。',
        ephemeral: true
      })
    } catch (error) {
      this.logger.error('Failed to send access denied message:', error)
    }
  }

  /**
   * キャラクター制限超過時の処理
   */
  async handleCharacterLimitExceeded(event: CharacterLimitExceeded): Promise<void> {
    try {
      await this.discordUIService.sendMessage({
        channelId: 'default', // イベントにchannelId情報がないため
        content: `⚠️ キャラクター数の上限に達しています。上限: ${event.maxLimit}`,
        ephemeral: true
      })
    } catch (error) {
      this.logger.error('Failed to send limit exceeded message:', error)
    }
  }
}
