import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventHandler, EventContext } from 'events/handlers/_shared/event-handler.base'
import { ThreadOrchestratorService } from 'discord/features/characterThread/services/thread-orchestrator.service'
import { TypedEventService } from 'src/core/events/typed-event.service'
import type { EventPayload } from 'events/contracts'
import { EVENT_NAMES } from 'events/contracts'

/**
 * discord.thread.create.requested 専用ハンドラー
 *
 * 🎯 責務:
 * - Discord スレッド作成リクエストの処理
 * - ThreadOrchestratorService への処理委譲
 * - File-based Event Handler アーキテクチャに準拠
 *
 * 🏗️ 登録方式:
 * - discord 層へ移設し、OnModuleInit で TypedEventService に自己購読する
 *   （旧: events 層の EventRegistryService による集中登録）
 * - EventHandler 基底の execute()（検証・ログ・統計・リトライ）は維持
 */
@Injectable()
export class DiscordThreadCreateRequestedHandler
  extends EventHandler<EventPayload<'discord.thread.create.requested'>>
  implements OnModuleInit
{
  constructor(
    private readonly threadOrchestrator: ThreadOrchestratorService,
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
   * イベント名の取得（必須実装）
   * 注: 契約リテラル型で返す（TypedEventService.on の厳密 EventName 型に適合させるため）
   */
  getEventName(): 'discord.thread.create.requested' {
    return EVENT_NAMES.DISCORD_THREAD_CREATE_REQUESTED
  }

  /**
   * メイン処理ロジック（必須実装）
   */
  async handle(event: EventPayload<'discord.thread.create.requested'>, context?: EventContext): Promise<void> {
    try {
      this.logger.log(
        `🧵 [${context?.correlationId}] Processing Discord thread creation request for character: ${event.character?.characterId}`
      )

      // ThreadOrchestratorService に処理を委譲
      await this.threadOrchestrator.handleThreadCreateRequest(event)

      this.logger.log(
        `✅ [${context?.correlationId}] Discord thread creation completed for character: ${event.character?.characterId}`
      )
    } catch (error) {
      this.logger.error(`❌ [${context?.correlationId}] Discord thread creation failed: ${error}`)

      throw error
    }
  }

  /**
   * カスタムバリデーション（オプション）
   */
  protected async customValidation(event: EventPayload<'discord.thread.create.requested'>): Promise<void> {
    if (!event.character) {
      throw new Error('Character is required for thread creation')
    }

    if (!event.channelId) {
      throw new Error('Channel ID is required for thread creation')
    }

    if (!event.guildId) {
      throw new Error('Guild ID is required for thread creation')
    }

    if (!event.creatorId) {
      throw new Error('Creator ID is required for thread creation')
    }
  }
}
