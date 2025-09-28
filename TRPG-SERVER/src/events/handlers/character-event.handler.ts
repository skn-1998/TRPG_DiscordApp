import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { GlobalEventBusService } from '../bus/global-event-bus.service'
import { TypedEventService } from '../../shared/application/typed-event.service'
import { Character } from '../../domains/character/models/character.model'
import {
  CharacterCreatedEvent,
  CharacterUpdatedEvent,
  CharacterDeletedEvent,
  CharacterCreationRequestedEvent,
  CharacterUpdateRequestedEvent,
  CharacterDeletionRequestedEvent,
  CharacterCreationFailedEvent
} from '../contracts'

/**
 * Character Event Handler
 * キャラクター関連のグローバルイベントハンドラー
 * Domain Events の統合処理を担当
 */
@Injectable()
export class CharacterEventHandler implements OnModuleInit {
  private readonly logger = new Logger(CharacterEventHandler.name)

  constructor(
    private readonly globalEventBus: GlobalEventBusService,
    private readonly typedEventService: TypedEventService
  ) {}

  onModuleInit(): void {
    this.registerEventHandlers()
    this.logger.log('Character Event Handler initialized')
  }

  /**
   * イベントハンドラー登録
   */
  private registerEventHandlers(): void {
    // Character Lifecycle Events (character.created はFile-based Event Handlersに統合済み)
    this.globalEventBus.on('character.updated', this.handleCharacterUpdated.bind(this))
    this.globalEventBus.on('character.deleted', this.handleCharacterDeleted.bind(this))

    // Character Request Events
    // 削除: character.creation.requestedはEvent Bridge経由で処理
    // this.globalEventBus.on('character.creation.requested', this.handleCharacterCreationRequested.bind(this))
    this.globalEventBus.on('character.update.requested', this.handleCharacterUpdateRequested.bind(this))
    this.globalEventBus.on('character.deletion.requested', this.handleCharacterDeletionRequested.bind(this))

    // Character Error Events
    this.globalEventBus.on('character.creation.failed', this.handleCharacterCreationFailed.bind(this))

    this.logger.debug('Character event handlers registered')
  }

  // character.created処理はFile-based Event Handlersに統合済み（character.creation.completed.ts）

  /**
   * キャラクター更新完了イベントハンドラー
   */
  private async handleCharacterUpdated(event: CharacterUpdatedEvent): Promise<void> {
    this.logger.log(`🔄 Character Updated: ${event.character.characterName} (${event.characterId})`)

    try {
      // Discord Embed更新リクエスト
      if (event.character.discordChannelId) {
        await this.globalEventBus.emit({
          type: 'discord.embed.update.requested',
          timestamp: new Date(),
          source: 'system',
          channelId: event.character.discordChannelId,
          embedData: {
            channelId: event.character.discordChannelId,
            characterId: event.characterId,
            embedType: 'character',
            updateMode: 'update'
          }
        })
      }

      // スレッド表示更新（threadIdがある場合）
      if (event.character.threadId) {
        await this.globalEventBus.emit({
          type: 'discord.embed.update.requested',
          timestamp: new Date(),
          source: 'system',
          channelId: event.character.threadId,
          embedData: {
            channelId: event.character.threadId,
            characterId: event.characterId,
            embedType: 'character',
            updateMode: 'update'
          }
        })
      }

      // 重要な変更の場合は通知
      const importantChanges = event.changes.some((change) =>
        ['characterName', 'status', 'parameter'].includes(change.field)
      )

      if (importantChanges && event.character.discordChannelId) {
        const changedFields = event.changes.map((c) => c.field).join(', ')
        await this.globalEventBus.emit({
          type: 'discord.notification.requested',
          timestamp: new Date(),
          source: 'system',
          channelId: event.character.discordChannelId,
          notification: {
            type: 'character.updated',
            channelId: event.character.discordChannelId,
            title: '🔄 キャラクター更新',
            message: `「${event.character.characterName}」の ${changedFields} が更新されました。`,
            color: 0x0099ff,
            characterId: event.characterId
          }
        })
      }
    } catch (error) {
      this.logger.error(`❌ Character updated event processing failed: ${event.characterId}`, error)
    }
  }

  /**
   * キャラクター削除完了イベントハンドラー
   */
  private async handleCharacterDeleted(event: CharacterDeletedEvent): Promise<void> {
    this.logger.log(`🗑️ Character Deleted: ${event.deletedCharacterData.characterName} (${event.characterId})`)

    try {
      // Discord通知
      if (event.deletedCharacterData.discordChannelId) {
        await this.globalEventBus.emit({
          type: 'discord.notification.requested',
          timestamp: new Date(),
          source: 'system',
          channelId: event.deletedCharacterData.discordChannelId,
          notification: {
            type: 'character.deleted',
            channelId: event.deletedCharacterData.discordChannelId,
            title: '🗑️ キャラクター削除',
            message: `キャラクター「${event.deletedCharacterData.characterName}」が削除されました。`,
            color: 0xff4444,
            characterId: event.characterId
          }
        })
      }
    } catch (error) {
      this.logger.error(`❌ Character deleted event processing failed: ${event.characterId}`, error)
    }
  }

  // 削除: Event Bridge移行完了により不要
  // handleCharacterCreationRequested メソッドは削除されました
  // 新しい処理は Universal Event Bridge → CharacterEdit Event Bridge で実行されます

  /**
   * キャラクター更新リクエストイベントハンドラー
   */
  private async handleCharacterUpdateRequested(event: CharacterUpdateRequestedEvent): Promise<void> {
    this.logger.debug(`🔄 Character Update Requested: ${event.characterId}`)

    // このハンドラーは更新リクエストのログ記録のみ
    // 実際の更新処理はDomainサービス（CharacterService）が担当
  }

  /**
   * キャラクター削除リクエストイベントハンドラー
   */
  private async handleCharacterDeletionRequested(event: CharacterDeletionRequestedEvent): Promise<void> {
    this.logger.debug(`🗑️ Character Deletion Requested: ${event.characterId}`)

    // このハンドラーは削除リクエストのログ記録のみ
    // 実際の削除処理はDomainサービス（CharacterService）が担当
  }

  /**
   * キャラクター作成失敗イベントハンドラー
   */
  private async handleCharacterCreationFailed(event: CharacterCreationFailedEvent): Promise<void> {
    this.logger.error(`❌ Character Creation Failed: ${event.error.message}`)

    try {
      // Discord通知（可能な場合）
      const channelId = event.createData?.discordChannelId
      if (channelId) {
        await this.globalEventBus.emit({
          type: 'discord.notification.requested',
          timestamp: new Date(),
          source: 'system',
          channelId,
          notification: {
            type: 'system.alert',
            channelId,
            title: '❌ キャラクター作成エラー',
            message: `キャラクター作成に失敗しました: ${event.error.message}`,
            color: 0xff0000
          }
        })
      }
    } catch (error) {
      this.logger.error(`❌ Character creation failed event processing failed`, error)
    }
  }
}
