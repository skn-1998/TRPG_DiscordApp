/**
 * Discord Event Router Service (ESCAPE FILE)
 *
 * ⚠️ このファイルは削除されたサービスのバックアップです
 * イベントの受信と関数への振り分けを一元管理する専用ルーティングサービス
 * - 各イベントに対する処理を1箇所で定義
 * - サービス間の責任を明確に分離
 * - 新しいイベント処理の追加が容易
 *
 * 削除理由: CharacterDisplayOrchestratorServiceとの重複
 * 代替実装: 既存のCharacterEventIntegrationServiceとThreadCreationServiceで対応
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../shared/application/typed-event.service'
import { Character } from '../../domains/character/models/character.model'

// ルーティング対象のサービスをインポート
import { ThreadCreationService } from '../features/characterThread/services/thread-creation.service'
import { EnhancedCharacterEditService } from '../features/characterEdit/enhanced-character-edit.service'

/**
 * イベントルーター
 *
 * すべてのTypedEventServiceイベントを受信し、
 * 適切なサービスメソッドに処理を振り分ける
 */
@Injectable()
export class EventRouterService implements OnModuleInit {
  private readonly logger = new Logger(EventRouterService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly threadCreationService: ThreadCreationService,
    private readonly enhancedCharacterEditService: EnhancedCharacterEditService
  ) {}

  /**
   * モジュール初期化時にイベントルーティングを設定
   */
  async onModuleInit(): Promise<void> {
    this.setupEventRoutes()
    this.logger.log('Event Router Service initialized - All event routes configured')
  }

  /**
   * イベントルーティングを設定
   * すべてのイベント処理をここで定義
   */
  private setupEventRoutes(): void {
    // ========================================
    // Character Events
    // ========================================

    // キャラクター更新イベント（メイン処理）
    this.typedEventService.on('character.updated', this.routeCharacterUpdated.bind(this))

    // その他のキャラクター関連イベント（TODO: 適切なイベント名に修正が必要）
    // this.typedEventService.on('character.creation.completed', this.routeCharacterCreated.bind(this))
    // this.typedEventService.on('character.deleted', this.routeCharacterDeleted.bind(this)) // 未定義イベント

    // ========================================
    // Discord Thread Events
    // ========================================

    // スレッド作成リクエスト
    this.typedEventService.on('discord.thread.create.requested', this.routeThreadCreateRequest.bind(this))

    // ========================================
    // Discord Display Events
    // ========================================

    // キャラクター表示リクエスト
    this.typedEventService.on('discord.character.display.requested', this.routeCharacterDisplayRequest.bind(this))

    // Embed更新リクエスト
    this.typedEventService.on('discord.embed.character.update.requested', this.routeEmbedUpdateRequest.bind(this))

    this.logger.debug('Event routes configured - Total routes: 6')
  }

  // ========================================
  // Event Routing Methods
  // ========================================

  /**
   * character.updated イベントルーティング
   * 最も重要なイベント処理 - すべてのキャラクター更新時の表示同期
   */
  private async routeCharacterUpdated(
    payload: import('../../shared/domain/events/event-contracts').EventPayload<'character.updated'>
  ): Promise<void> {
    const { character, updateType, source } = payload

    this.logger.log(`[EVENT-ROUTER] Routing character.updated: ${character.characterId} (${updateType}) from ${source}`)

    try {
      // 並行処理で各種表示を更新
      const updatePromises = []

      // 1. Thread表示の更新（threadIdがある場合）
      if (character.threadId) {
        this.logger.debug(`[EVENT-ROUTER] Routing to ThreadCreationService for character: ${character.characterId}`)
        updatePromises.push(
          this.threadCreationService.updateCharacterThreadDisplay(character).catch((error) => {
            this.logger.error(`[EVENT-ROUTER] Thread display update failed for ${character.characterId}:`, error)
          })
        )
      }

      // 2. Character-Edit表示の更新（discordChannelIdまたはdiscordEditChannelIdがある場合）
      if (character.discordChannelId || character.discordEditChannelId) {
        this.logger.debug(
          `[EVENT-ROUTER] Routing to EnhancedCharacterEditService for character: ${character.characterId}`
        )
        const channelId = character.discordChannelId || character.discordEditChannelId
        updatePromises.push(
          this.typedEventService
            .emit('discord.embed.character.update.requested', {
              character,
              channelId: channelId!,
              displayType: 'enhanced',
              source: 'event-router',
              timestamp: new Date()
            })
            .catch((error: Error) => {
              this.logger.error(
                `[EVENT-ROUTER] Character-edit display update failed for ${character.characterId}:`,
                error
              )
            })
        )
      }

      // 3. 必要に応じて他の表示更新を追加可能
      // 例: WebSocket通知、外部API連携など

      // すべての更新処理を並行実行
      await Promise.all(updatePromises)

      this.logger.log(`[EVENT-ROUTER] Character update routing completed for: ${character.characterId}`)
    } catch (error) {
      this.logger.error(`[EVENT-ROUTER] Error routing character.updated for ${character.characterId}:`, error)
    }
  }

  /**
   * discord.thread.create.requested イベントルーティング
   */
  private async routeThreadCreateRequest(
    payload: import('../../shared/domain/events/event-contracts').EventPayload<'discord.thread.create.requested'>
  ): Promise<void> {
    const { character, channelId, source } = payload

    this.logger.log(`[EVENT-ROUTER] Routing thread create request: ${character.characterId} from ${source}`)

    try {
      // ThreadCreationServiceに処理を委譲
      await this.threadCreationService.handleThreadCreateRequest(payload)

      this.logger.log(`[EVENT-ROUTER] Thread create request routed successfully for: ${character.characterId}`)
    } catch (error) {
      this.logger.error(`[EVENT-ROUTER] Error routing thread create request for ${character.characterId}:`, error)
    }
  }

  /**
   * discord.character.display.requested イベントルーティング
   */
  private async routeCharacterDisplayRequest(
    payload: import('../../shared/domain/events/event-contracts').EventPayload<'discord.character.display.requested'>
  ): Promise<void> {
    const { character, channelId, displayType, source } = payload

    this.logger.log(
      `[EVENT-ROUTER] Routing character display request: ${character.characterId} (${displayType}) from ${source}`
    )

    try {
      // displayTypeに応じて適切なサービスに振り分け
      if (displayType === 'enhanced') {
        // EnhancedCharacterEditServiceに処理を委譲
        await this.typedEventService.emit('discord.embed.character.update.requested', {
          character,
          channelId,
          displayType,
          source: 'event-router',
          timestamp: new Date()
        })
      } else {
        // 基本表示は別のサービスで処理（TODO: 実装が必要）
        this.logger.debug(`[EVENT-ROUTER] Basic display routing not implemented for displayType: ${displayType}`)
      }

      this.logger.log(`[EVENT-ROUTER] Character display request routed successfully for: ${character.characterId}`)
    } catch (error) {
      this.logger.error(`[EVENT-ROUTER] Error routing character display request for ${character.characterId}:`, error)
    }
  }

  /**
   * discord.embed.character.update.requested イベントルーティング
   */
  private async routeEmbedUpdateRequest(
    payload: import('../../shared/domain/events/event-contracts').EventPayload<'discord.embed.character.update.requested'>
  ): Promise<void> {
    const { character, channelId, displayType, source } = payload

    this.logger.log(
      `[EVENT-ROUTER] Routing embed update request: ${character.characterId} (${displayType}) from ${source}`
    )

    try {
      // displayTypeが'enhanced'の場合のみEnhancedCharacterEditServiceで処理
      if (displayType === 'enhanced') {
        await this.enhancedCharacterEditService.handleDiscordEmbedUpdateRequested(payload)

        this.logger.log(`[EVENT-ROUTER] Embed update request routed successfully for: ${character.characterId}`)
      } else {
        this.logger.debug(`[EVENT-ROUTER] Skipping enhanced display routing for displayType: ${displayType}`)
      }
    } catch (error) {
      this.logger.error(`[EVENT-ROUTER] Error routing embed update request for ${character.characterId}:`, error)
    }
  }

  // ========================================
  // Future Event Routing Methods (未実装)
  // ========================================

  /**
   * character.creation.completed イベントルーティング（未実装）
   */
  private async routeCharacterCreated(payload: any): Promise<void> {
    this.logger.debug('[EVENT-ROUTER] Character creation routing - Not implemented yet')
    // TODO: キャラクター作成完了時の処理を実装
  }

  /**
   * character.deleted イベントルーティング（未実装）
   */
  private async routeCharacterDeleted(payload: any): Promise<void> {
    this.logger.debug('[EVENT-ROUTER] Character deletion routing - Not implemented yet')
    // TODO: キャラクター削除時の処理を実装
  }
}
