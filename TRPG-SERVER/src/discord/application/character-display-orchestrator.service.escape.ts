/**
 * Character Display Orchestrator Service (ESCAPE FILE)
 *
 * ⚠️ このファイルは削除されたサービスのバックアップです
 * character.updatedイベントを一元管理し、各種Discord表示を適切に更新する
 * イベント処理の重複を防ぎ、責任の明確化を図る
 *
 * 削除理由: EventRouterServiceとの重複
 * 代替実装: 既存のCharacterEventIntegrationServiceとThreadCreationServiceで対応
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../shared/application/typed-event.service'
import { Character } from '../../domains/character/models/character.model'
import { ThreadCreationService } from '../features/characterThread/services/thread-creation.service'
import { EnhancedCharacterEditService } from '../features/characterEdit/enhanced-character-edit.service'

/**
 * キャラクター表示オーケストレーター
 *
 * 全てのcharacter.updatedイベントを受信し、
 * 適切なサービスに処理を委譲する中央管理サービス
 */
@Injectable()
export class CharacterDisplayOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(CharacterDisplayOrchestratorService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly threadCreationService: ThreadCreationService,
    private readonly enhancedCharacterEditService: EnhancedCharacterEditService
  ) {}

  /**
   * モジュール初期化時にイベントハンドラーを登録
   */
  async onModuleInit(): Promise<void> {
    this.registerEventHandlers()
    this.logger.log('Character Display Orchestrator Service initialized')
  }

  /**
   * イベントハンドラーを登録
   */
  private registerEventHandlers(): void {
    // character.updatedイベントのハンドラーを登録
    this.typedEventService.on('character.updated', this.handleCharacterUpdated.bind(this))

    this.logger.debug('Character display orchestrator event handlers registered')
  }

  /**
   * キャラクター更新イベントを一元的に処理
   */
  private async handleCharacterUpdated(
    payload: import('../../shared/domain/events/event-contracts').EventPayload<'character.updated'>
  ): Promise<void> {
    const { character, updateType, source } = payload

    this.logger.log(
      `[ORCHESTRATOR] Processing character update: ${character.characterId} (${updateType}) from ${source}`
    )

    try {
      // 並行処理で各種表示を更新
      const updatePromises = []

      // 1. Thread表示の更新（threadIdがある場合）
      if (character.threadId) {
        this.logger.debug(`[ORCHESTRATOR] Updating thread display for: ${character.characterId}`)
        updatePromises.push(
          this.threadCreationService.updateCharacterThreadDisplay(character).catch((error) => {
            this.logger.error(`[ORCHESTRATOR] Thread display update failed for ${character.characterId}:`, error)
          })
        )
      }

      // 2. Character-Edit表示の更新（discordChannelIdまたはdiscordEditChannelIdがある場合）
      if (character.discordChannelId || character.discordEditChannelId) {
        this.logger.debug(`[ORCHESTRATOR] Updating character-edit display for: ${character.characterId}`)
        const channelId = character.discordChannelId || character.discordEditChannelId
        updatePromises.push(
          this.typedEventService
            .emit('discord.embed.character.update.requested', {
              character,
              channelId: channelId!,
              displayType: 'enhanced',
              source: 'character-display-orchestrator',
              timestamp: new Date()
            })
            .catch((error: Error) => {
              this.logger.error(
                `[ORCHESTRATOR] Character-edit display update failed for ${character.characterId}:`,
                error
              )
            })
        )
      }

      // 3. 必要に応じて他の表示更新を追加可能
      // 例: WebSocket通知、外部システム連携など

      // すべての更新処理を並行実行
      await Promise.all(updatePromises)

      this.logger.log(`[ORCHESTRATOR] Character update processing completed for: ${character.characterId}`)
    } catch (error) {
      this.logger.error(`[ORCHESTRATOR] Error processing character update for ${character.characterId}:`, error)
    }
  }

  /**
   * 手動でキャラクター表示更新を実行（デバッグ用）
   */
  async manualUpdateCharacterDisplay(character: Character): Promise<void> {
    this.logger.log(`[ORCHESTRATOR] Manual character display update triggered for: ${character.characterId}`)

    await this.handleCharacterUpdated({
      character,
      updateType: 'manual',
      source: 'manual-trigger',
      timestamp: new Date()
    })
  }

  /**
   * 統計情報を取得（監視・デバッグ用）
   */
  getStatistics(): {
    threadUpdatesProcessed: number
    editUpdatesProcessed: number
    totalEventsHandled: number
    lastProcessedAt: Date | null
  } {
    // TODO: 実際の統計情報収集機能を実装
    return {
      threadUpdatesProcessed: 0,
      editUpdatesProcessed: 0,
      totalEventsHandled: 0,
      lastProcessedAt: null
    }
  }
}
