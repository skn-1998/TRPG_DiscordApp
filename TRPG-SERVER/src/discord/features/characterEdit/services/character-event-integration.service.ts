import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { CharacterService } from '../../../../domains/character/character.service'
import { CharacterCreationService } from './character-creation.service'
import { CharacterNotificationService } from './character-notification.service'
import { TextChannel } from 'discord.js'

/**
 * Character Event Integration Service
 *
 * CharacterEventHandlerServiceをfeatures/characterEdit/に統合
 * TypedEventServiceで発行されるキャラクター関連イベントを
 * features/内のOrchestratorパターンで処理
 */
@Injectable()
export class CharacterEventIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(CharacterEventIntegrationService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly characterService: CharacterService,
    private readonly characterCreationService: CharacterCreationService,
    private readonly characterNotificationService: CharacterNotificationService
  ) {}

  /**
   * モジュール初期化時にイベントハンドラーを登録
   */
  async onModuleInit(): Promise<void> {
    this.registerEventHandlers()
    this.logger.log('Character Event Integration Service initialized (features/characterEdit/)')
  }

  /**
   * イベントハンドラーを登録
   *
   * 🚨 重複登録問題により無効化済み
   *
   * 理由: 以下のイベントリスナーはFile-based Event Handlersで処理済み：
   * - character.findByChannelId.requested → CharacterFindByChannelIdRequestedHandler
   * - character.findById.requested → CharacterFindByIdRequestedHandler
   * - character.update.requested → CharacterUpdateRequestedHandler
   *
   * このサービスは重複機能として、将来的に削除予定です。
   */
  private registerEventHandlers(): void {
    // 🚨 すべてのイベントリスナーはFile-based Event Handlersに移行済み
    // 重複登録を避けるため、このメソッドでのリスナー登録は無効化

    this.logger.debug('Character event handlers registration skipped (migrated to File-based Event Handlers)')
  }

  /**
   * チャンネルIDによるキャラクター検索を処理
   */
  private async handleCharacterSearchByChannelId(payload: any): Promise<void> {
    const { channelId, source, timestamp } = payload

    this.logger.debug(`[CHARACTER-SEARCH] チャンネルID検索: ${channelId}`)

    try {
      const character = await this.characterService.findByChannelId(channelId)

      // 検索完了イベントを発行
      await this.typedEventService.emit('character.findByChannelId.completed', {
        channelId,
        character,
        source,
        timestamp: new Date()
      })

      this.logger.debug(`キャラクター検索結果: ${character ? character.characterId : 'not found'}`)
    } catch (error) {
      this.logger.error(`チャンネルID検索エラー: ${channelId}`, error)

      // 検索失敗イベントを発行
      await this.typedEventService.emit('character.findByChannelId.failed', {
        channelId,
        error: error instanceof Error ? error.message : String(error),
        source,
        timestamp: new Date()
      })
    }
  }

  /**
   * IDによるキャラクター検索を処理
   */
  private async handleCharacterSearchById(payload: any): Promise<void> {
    const { characterId, source, timestamp } = payload

    this.logger.debug(`[CHARACTER-SEARCH] ID検索: ${characterId}`)

    try {
      const character = await this.characterService.findOne(characterId)

      // 検索完了イベントを発行
      await this.typedEventService.emit('character.findById.completed', {
        characterId,
        character,
        source,
        timestamp: new Date()
      })

      this.logger.debug(`キャラクターID検索結果: ${character ? character.characterId : 'not found'}`)
    } catch (error) {
      this.logger.error(`キャラクターID検索エラー: ${characterId}`, error)

      // 検索失敗イベントを発行
      await this.typedEventService.emit('character.findById.failed', {
        characterId,
        error: error instanceof Error ? error.message : String(error),
        source,
        timestamp: new Date()
      })
    }
  }

  /**
   * キャラクター更新リクエストを処理
   */
  private async handleCharacterUpdateRequest(payload: any): Promise<void> {
    const { channelId, updateData, userId, source, timestamp } = payload

    this.logger.debug(`[CHARACTER-UPDATE] 更新リクエスト: ${channelId}`)

    try {
      const updatedCharacter = await this.characterService.updateByChannelId(channelId, updateData)

      if (updatedCharacter) {
        // 更新完了通知は character.update.requested -> completed 経由で自動処理される
        this.logger.debug(`キャラクター更新完了: ${updatedCharacter.characterId}`)
      } else {
        throw new Error('Character not found or update failed')
      }
    } catch (error) {
      this.logger.error(`キャラクター更新エラー: ${channelId}`, error)

      // 更新失敗イベントを発行
      await this.typedEventService.emit('character.update.failed', {
        channelId,
        error: error instanceof Error ? error.message : String(error),
        source,
        timestamp: new Date()
      })
    }
  }

  // 削除: Event Bridge移行完了によりレガシー処理は不要
  // handleCharacterCreationRequest メソッドは削除されました
  // 新しい処理は character-edit-creation.handler.ts で実行されます
}
