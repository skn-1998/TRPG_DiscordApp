import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventHandler, EventContext } from 'events/handlers/_shared/event-handler.base'
import { ThreadOrchestratorService } from 'discord/features/characterThread/services/thread-orchestrator.service'
import { CharacterUpdateCompletedEvent } from 'events/contracts/unified-event-contracts'
import { EVENT_NAMES } from 'events/contracts'
import { TypedEventService } from 'src/core/events/typed-event.service'

/**
 * character.update.completed 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター更新完了時のスレッド表示更新
 *
 * 🏗️ 登録方式:
 * - discord 層へ移設し、OnModuleInit で TypedEventService に自己購読する
 *   （旧: events 層の EventRegistryService による集中登録）
 * - EventHandler 基底の execute()（検証・ログ・統計・リトライ）は維持
 */
@Injectable()
export class CharacterUpdateCompletedHandler
  extends EventHandler<CharacterUpdateCompletedEvent>
  implements OnModuleInit
{
  constructor(
    private readonly threadOrchestratorService: ThreadOrchestratorService,
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
   * 処理するイベント名
   * 注: 契約リテラル型で返す（TypedEventService.on の厳密 EventName 型に適合させるため）
   */
  getEventName(): 'character.update.completed' {
    return EVENT_NAMES.CHARACTER_UPDATE_COMPLETED
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterUpdateCompletedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🎭 Processing character update completed: ${event.character.characterName}`)

    try {
      // Discord UI更新処理
      await this.updateDiscordUI(event, context)

      this.logger.log(`✅ Character update UI refresh completed: ${event.character.characterId}`)
    } catch (error) {
      this.logger.error(
        `❌ Character update UI refresh failed: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * Discord UI更新処理
   */
  private async updateDiscordUI(event: CharacterUpdateCompletedEvent, _context?: EventContext): Promise<void> {
    const { character } = event

    // スレッドが存在する場合、Thread内のEmbedを更新
    if (character.discordThreadId) {
      this.logger.debug(`Updating character thread display in thread: ${character.discordThreadId}`)

      try {
        await this.threadOrchestratorService.updateCharacterThreadDisplay(character)
        this.logger.debug(`✅ Character thread display updated successfully`)
      } catch (error) {
        this.logger.warn(
          `⚠️ Character thread display update failed: ${error instanceof Error ? error.message : String(error)}`
        )
        // Thread Embed更新の失敗は致命的ではないため、処理を続行
      }
    }

    // 契約外 updatedFields に依存していたステータス表示更新の分岐は撤去（E-4a）:
    // 実 emit（character-modal-handler）は updatedFields を渡しておらず、到達不能の dead 分岐だった。
  }

  /**
   * リトライ可能エラーの判定
   */
  protected override isRetryableError(error: Error): boolean {
    // Discord API関連のエラーはリトライ可能
    if (error.message.includes('Discord') || error.message.includes('API')) {
      return true
    }

    return super.isRetryableError(error)
  }

  /**
   * 最大リトライ回数
   */
  protected override getMaxRetries(): number {
    return 2 // Discord API呼び出しのため控えめに設定
  }
}
