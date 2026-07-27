import { Injectable, Logger } from '@nestjs/common'
import { CharacterEntity, resolveCharacterState } from '../../../../domains/character/models/character.entity'
import { CharacterService } from '../../../../domains/character/character.service'
import { EventPayload } from '../../../../events/contracts'

import { isMaterializedWithoutChannel } from './character-channel-binding.util'
import { ThreadManagerService, CreateThreadRequest } from './thread-manager.service'
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
    private readonly characterService: CharacterService
  ) {
    this.logger.debug('Thread orchestrator service initialized')
  }

  /**
   * スレッド作成リクエストイベントを処理
   */
  async handleThreadCreateRequest(payload: EventPayload<'discord.thread.create.requested'>): Promise<void> {
    const { character, channelId, guildId, creatorId, displayType } = payload

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

      // 同じ述語の3適用点（L2）: event 経路の副作用直前で止める。
      if (isMaterializedWithoutChannel(character)) {
        this.logger.warn(
          `Thread creation skipped: character ${character.characterId} is materialized but discordChannelId is not linked`
        )
        // この return が発火した場合、同じ discord.thread.create.requested を購読する
        // HubThreadEventListener は 30 秒 poll のうえ Hub remains none… を error 出力する
        // （現状は producer 2つとも上流でガード済みのため到達不能）。
        return
      }

      // 1. スレッド作成
      const result = await this.threadManager.createCharacterThread(request, character)

      if (!result.success || !result.threadId) {
        throw new Error(result.error || 'Thread creation failed')
      }

      // 2. スレッドIDをキャラクターに保存（discordThreadId が正。E-6a: deprecated threadId への二重書きは廃止）
      this.logger.log(`[ORCHESTRATOR] Updating character ${character.characterId} with threadId: ${result.threadId}`)
      await this.characterService.update(character.characterId, {
        discordThreadId: result.threadId
      })
      this.logger.log(`[ORCHESTRATOR] Character updated successfully`)

      if (resolveCharacterState(character) === 'materialized') {
        this.logger.log(`Thread creation completed: ${result.threadId}`)
        return
      }

      // 3. スレッドを取得
      this.logger.log(`[ORCHESTRATOR] Fetching created thread: ${result.threadId}`)
      const thread = await this.threadManager.getThreadChannel(result.threadId)
      if (!thread) {
        this.logger.error(`[ORCHESTRATOR] Created thread not found: ${result.threadId}`)
        throw new Error(`Created thread not found: ${result.threadId}`)
      }
      this.logger.log(`[ORCHESTRATOR] Thread fetched successfully: ${thread.name} (archived: ${thread.archived})`)

      // 4. キャラクター情報を投稿
      await this.characterEmbed.postCharacterDisplay(thread, character, displayType)

      // 5. インタラクティブ要素を投稿
      await this.threadInteraction.postBasicDiceButtons(thread, character)
      await this.threadInteraction.postFlexibleDiceMenu(thread, character)
      await this.threadInteraction.postPresetDiceButtons(thread, character)
      await this.threadInteraction.postSkillRollButtons(thread, character)
      await this.threadInteraction.postAbilityRollButtons(thread, character)

      this.logger.log(`Thread creation completed: ${result.threadId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to handle thread create request: ${errorMessage}`, error)

      throw error
    }
  }

  /**
   * キャラクター表示更新
   */
  async updateCharacterThreadDisplay(character: CharacterEntity): Promise<void> {
    try {
      if (!character.discordThreadId) {
        this.logger.warn(`No thread ID found for character: ${character.characterId}`)
        return
      }

      const thread = await this.threadManager.getThreadChannel(character.discordThreadId)
      if (!thread) {
        this.logger.warn(`Thread not found: ${character.discordThreadId}`)
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
      if (!character?.discordThreadId) {
        this.logger.warn(`No thread ID found for character: ${characterId}`)
        return false
      }

      const result = await this.threadManager.archiveThread(character.discordThreadId)

      if (result) {
        this.logger.log(`Character thread archived: ${character.discordThreadId}`)
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
      if (!character?.discordThreadId) {
        this.logger.warn(`No thread ID found for character: ${characterId}`)
        return false
      }

      const result = await this.threadManager.unarchiveThread(character.discordThreadId)

      if (result) {
        this.logger.log(`Character thread unarchived: ${character.discordThreadId}`)
      }

      return result
    } catch (error) {
      this.logger.error(`Failed to unarchive character thread: ${characterId}`, error)
      return false
    }
  }
}
