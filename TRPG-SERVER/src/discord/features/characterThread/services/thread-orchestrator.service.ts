import { Injectable, Logger } from '@nestjs/common'
import { Character } from '../../../../domains/character/models/character.model'
import { CharacterService } from '../../../../domains/character/character.service'
import { TypedEventService } from '../../../../shared/application/typed-event.service'

import { ThreadManagerService, CreateThreadRequest, CreateThreadResult } from './thread-manager.service'
import { CharacterEmbedService } from './character-embed.service'
import { ThreadInteractionService } from './thread-interaction.service'

/**
 * スレッドオーケストレーターサービス
 *
 * 責務：
 * - 分割されたサービス間の協調
 * - イベント処理の統合
 * - 完全なスレッド作成フローの管理
 */
@Injectable()
export class ThreadOrchestratorService {
  private readonly logger = new Logger(ThreadOrchestratorService.name)

  constructor(
    private readonly threadManager: ThreadManagerService,
    private readonly characterEmbed: CharacterEmbedService,
    private readonly threadInteraction: ThreadInteractionService,
    private readonly characterService: CharacterService,
    private readonly typedEventService: TypedEventService
  ) {
    this.logger.debug('Thread orchestrator service initialized')
  }

  /**
   * スレッド作成リクエストイベントを処理
   */
  async handleThreadCreateRequest(
    payload: import('../../../../shared/domain/events/event-contracts').EventPayload<'discord.thread.create.requested'>
  ): Promise<void> {
    const { character, channelId, guildId, creatorId, displayType, source } = payload

    this.logger.log(`Handling thread create request for character: ${character.characterId}`)

    try {
      const request: CreateThreadRequest = {
        characterId: character.characterId,
        characterName: character.characterName,
        channelId,
        guildId,
        creatorId,
        displayType
      }

      // 1. スレッド作成
      const result = await this.threadManager.createCharacterThread(request, character)

      if (!result.success || !result.threadId) {
        throw new Error(result.error || 'Thread creation failed')
      }

      // 2. スレッドIDをキャラクターに保存
      await this.characterService.update(character.characterId, {
        threadId: result.threadId
      })

      // 3. スレッドを取得
      const thread = await this.threadManager.getThreadChannel(result.threadId)
      if (!thread) {
        throw new Error(`Created thread not found: ${result.threadId}`)
      }

      // 4. キャラクター情報を投稿
      await this.characterEmbed.postCharacterDisplay(thread, character, displayType)

      // 5. インタラクティブ要素を投稿
      await this.threadInteraction.postActionButtons(thread, character.discordChannelId || character.characterId)
      await this.threadInteraction.postFlexibleDiceMenu(thread, character)
      await this.threadInteraction.postPresetDiceButtons(thread, character)
      await this.threadInteraction.postSkillRollButtons(thread, character)

      this.logger.log(`Thread creation completed: ${result.threadId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to handle thread create request: ${errorMessage}`, error)

      // エラーイベントを発行
      await this.typedEventService.emit('character-thread.creation.failed', {
        threadId: `error-${Date.now()}`,
        characterId: character.characterId,
        characterName: character.characterName,
        channelId,
        creatorId,
        guildId,
        error: errorMessage,
        timestamp: new Date(),
        source: 'thread-orchestrator-service'
      })

      throw error
    }
  }

  /**
   * キャラクター表示更新
   */
  async updateCharacterThreadDisplay(character: Character): Promise<void> {
    try {
      if (!character.threadId) {
        this.logger.warn(`No thread ID found for character: ${character.characterId}`)
        return
      }

      const thread = await this.threadManager.getThreadChannel(character.threadId)
      if (!thread) {
        this.logger.warn(`Thread not found: ${character.threadId}`)
        return
      }

      await this.characterEmbed.updateCharacterDisplay(character)

      this.logger.debug(`Character thread display updated: ${character.characterName}`)
    } catch (error) {
      this.logger.error(`Failed to update character thread display: ${character.characterName}`, error)
      throw error
    }
  }

  /**
   * スレッドアーカイブ
   */
  async archiveCharacterThread(characterId: string): Promise<boolean> {
    try {
      const character = await this.characterService.findOne(characterId)
      if (!character?.threadId) {
        this.logger.warn(`No thread ID found for character: ${characterId}`)
        return false
      }

      const result = await this.threadManager.archiveThread(character.threadId)

      if (result) {
        this.logger.log(`Character thread archived: ${character.threadId}`)
      }

      return result
    } catch (error) {
      this.logger.error(`Failed to archive character thread: ${characterId}`, error)
      return false
    }
  }

  /**
   * スレッドアンアーカイブ
   */
  async unarchiveCharacterThread(characterId: string): Promise<boolean> {
    try {
      const character = await this.characterService.findOne(characterId)
      if (!character?.threadId) {
        this.logger.warn(`No thread ID found for character: ${characterId}`)
        return false
      }

      const result = await this.threadManager.unarchiveThread(character.threadId)

      if (result) {
        this.logger.log(`Character thread unarchived: ${character.threadId}`)
      }

      return result
    } catch (error) {
      this.logger.error(`Failed to unarchive character thread: ${characterId}`, error)
      return false
    }
  }
}
