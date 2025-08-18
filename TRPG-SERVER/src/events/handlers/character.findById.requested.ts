import { Injectable, Logger } from '@nestjs/common'
import { EventHandler, EventContext, ValidationError } from './_shared/event-handler.base'
import { validateRequired, validateCharacterId } from './_shared/validation.utils'
import { CharacterService } from '../../domains/character/character.service'
import { CharacterFindByIdRequestedEvent } from '../contracts/unified-event-contracts'

/**
 * character.findById.requested 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクターIDでの検索リクエスト処理
 * - 検索結果の返却（見つからない場合はnull）
 * - 成功・失敗イベントの発行
 */
@Injectable()
export class CharacterFindByIdRequestedHandler extends EventHandler<CharacterFindByIdRequestedEvent> {
  constructor(private readonly characterService: CharacterService) {
    super()
  }

  /**
   * 処理するイベント名
   */
  getEventName(): string {
    return 'character.findById.requested'
  }

  /**
   * カスタムバリデーション
   */
  protected async customValidation(event: CharacterFindByIdRequestedEvent): Promise<void> {
    // 必須フィールド検証
    validateRequired(event, ['characterId', 'source'])

    // キャラクターID形式検証
    validateCharacterId(event.characterId, 'characterId')
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterFindByIdRequestedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🔍 Searching character by ID: ${event.characterId}`)

    try {
      // キャラクター検索実行
      const character = await this.characterService.findOne(event.characterId)

      // 成功イベント発行（見つからない場合もnullで成功として扱う）
      await this.emitSuccessEvent(character, event, context)

      if (character) {
        this.logger.log(`✅ Character found: ${character.characterId} (${character.characterName})`)
      } else {
        this.logger.log(`ℹ️ No character found with ID: ${event.characterId}`)
      }
    } catch (error) {
      // 失敗イベント発行
      await this.emitFailureEvent(error as Error, event, context)
      throw error
    }
  }

  /**
   * 成功イベントの発行
   */
  private async emitSuccessEvent(
    character: any | null,
    originalEvent: CharacterFindByIdRequestedEvent,
    context?: EventContext
  ): Promise<void> {
    const successEvent = {
      characterId: originalEvent.characterId,
      character,
      source: originalEvent.source,
      timestamp: new Date()
    }

    await this.typedEventService?.emit('character.findById.completed', successEvent)

    this.logger.debug(`📤 Success event emitted: character.findById.completed for ${originalEvent.characterId}`)
  }

  /**
   * 失敗イベントの発行
   */
  private async emitFailureEvent(
    error: Error,
    originalEvent: CharacterFindByIdRequestedEvent,
    context?: EventContext
  ): Promise<void> {
    const failureEvent = {
      characterId: originalEvent.characterId,
      error: error.message,
      source: originalEvent.source,
      timestamp: new Date()
    }

    await this.typedEventService?.emit('character.findById.failed', failureEvent)

    this.logger.error(`📤 Failure event emitted: character.findById.failed - ${error.message}`)
  }

  /**
   * リトライ可能エラーの判定（オーバーライド）
   */
  protected isRetryableError(error: Error): boolean {
    // バリデーションエラーはリトライしない
    if (error instanceof ValidationError) {
      return false
    }

    // データベース接続エラーなどはリトライ対象
    return super.isRetryableError(error)
  }

  /**
   * 最大リトライ回数（オーバーライド）
   */
  protected getMaxRetries(): number {
    return 1 // 検索は最大1回リトライ
  }
}
