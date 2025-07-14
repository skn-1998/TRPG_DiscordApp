import { Injectable, Logger } from '@nestjs/common'
import { EventBusService } from '../../../../shared/application/event-bus.service'
import { CharacterRepository } from '../../repositories/character.repository'
import {
  CharacterNameUpdateRequestedPrototype,
  CharacterNameUpdatedPrototype,
  CharacterNameUpdateFailedPrototype
} from './character-name-events.prototype'

/**
 * プロトタイプ: キャラクター名更新 Application Service
 * イベント駆動アーキテクチャの実行可能性を検証するための最小限の実装
 */
@Injectable()
export class CharacterNameUpdatePrototype {
  private readonly logger = new Logger(CharacterNameUpdatePrototype.name)

  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly eventBus: EventBusService
  ) {
    this.registerEventHandlers()
  }

  /**
   * イベントハンドラーを登録
   */
  private registerEventHandlers(): void {
    this.eventBus.subscribe('character.name.update.requested.prototype', {
      handle: this.handleCharacterNameUpdateRequest.bind(this)
    })
  }

  /**
   * 外部システムからのキャラクター名更新要求を処理
   */
  async requestCharacterNameUpdate(channelId: string, newName: string, userId: string): Promise<void> {
    this.logger.log(`[PROTOTYPE] Requesting character name update: ${channelId}`)

    // 入力検証
    if (!channelId || !newName || !userId) {
      this.logger.error('[PROTOTYPE] Invalid input parameters')
      await this.eventBus.publish(
        new CharacterNameUpdateFailedPrototype(
          channelId || 'unknown',
          newName || 'unknown',
          'Invalid input parameters',
          userId || 'unknown'
        )
      )
      return
    }

    // 名前の基本検証
    if (newName.length > 100) {
      this.logger.error('[PROTOTYPE] Character name too long')
      await this.eventBus.publish(
        new CharacterNameUpdateFailedPrototype(
          channelId,
          newName,
          'Character name must be 100 characters or less',
          userId
        )
      )
      return
    }

    // イベント発行
    await this.eventBus.publish(new CharacterNameUpdateRequestedPrototype(channelId, newName, userId))
  }

  /**
   * キャラクター名更新要求イベントの処理
   */
  async handleCharacterNameUpdateRequest(event: CharacterNameUpdateRequestedPrototype): Promise<void> {
    const startTime = Date.now()
    this.logger.log(`[PROTOTYPE] Processing character name update: ${event.channelId}`)

    try {
      // 1. 既存キャラクター取得
      const character = await this.characterRepository.findByChannelId(event.channelId)

      if (!character) {
        this.logger.error(`[PROTOTYPE] Character not found: ${event.channelId}`)
        await this.eventBus.publish(
          new CharacterNameUpdateFailedPrototype(event.channelId, event.newName, 'Character not found', event.userId)
        )
        return
      }

      // 2. 権限チェック（キャラクターの所有者のみ変更可能）
      if (character.discordUserId !== event.userId) {
        this.logger.error(`[PROTOTYPE] Unauthorized update attempt: ${event.userId}`)
        await this.eventBus.publish(
          new CharacterNameUpdateFailedPrototype(event.channelId, event.newName, 'Unauthorized access', event.userId)
        )
        return
      }

      // 3. 名前が同じ場合はスキップ
      if (character.characterName === event.newName) {
        this.logger.log(`[PROTOTYPE] Character name is already ${event.newName}`)
        await this.eventBus.publish(
          new CharacterNameUpdatedPrototype(
            character.characterId,
            character.characterName,
            event.newName,
            event.channelId
          )
        )
        return
      }

      // 4. 名前変更実行
      const oldName = character.characterName
      const updateData = { characterName: event.newName }

      const updatedCharacter = await this.characterRepository.updateByChannelId(event.channelId, updateData)

      if (!updatedCharacter) {
        this.logger.error(`[PROTOTYPE] Failed to update character name: ${event.channelId}`)
        await this.eventBus.publish(
          new CharacterNameUpdateFailedPrototype(event.channelId, event.newName, 'Database update failed', event.userId)
        )
        return
      }

      // 5. 成功イベント発行
      await this.eventBus.publish(
        new CharacterNameUpdatedPrototype(updatedCharacter.characterId, oldName, event.newName, event.channelId)
      )

      const processingTime = Date.now() - startTime
      this.logger.log(
        `[PROTOTYPE] Character name updated successfully in ${processingTime}ms: ${updatedCharacter.characterId}`
      )
    } catch (error) {
      this.logger.error(`[PROTOTYPE] Error updating character name:`, error)

      await this.eventBus.publish(
        new CharacterNameUpdateFailedPrototype(
          event.channelId,
          event.newName,
          error instanceof Error ? error.message : 'Unknown error',
          event.userId
        )
      )
    }
  }
}
