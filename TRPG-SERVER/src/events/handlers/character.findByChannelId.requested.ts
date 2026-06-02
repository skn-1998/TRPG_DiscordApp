import { Injectable } from '@nestjs/common'
import { EventHandler, EventContext, ValidationError } from './_shared/event-handler.base'
import { validateRequired, validateDiscordId } from './_shared/validation.utils'
import { CharacterService } from '../../domains/character/character.service'
import { CharacterFindByChannelIdRequestedEvent } from '../contracts/unified-event-contracts'

/**
 * character.findByChannelId.requested 専用ハンドラー
 *
 * 🎯 責務:
 * - チャンネルIDでのキャラクター検索リクエスト処理
 * - 検索結果の返却（見つからない場合はnull）
 * - 成功・失敗イベントの発行
 */
@Injectable()
export class CharacterFindByChannelIdRequestedHandler extends EventHandler<CharacterFindByChannelIdRequestedEvent> {
  constructor(private readonly characterService: CharacterService) {
    super()
  }

  /**
   * 処理するイベント名
   */
  getEventName(): string {
    return 'character.findByChannelId.requested'
  }

  /**
   * カスタムバリデーション
   */
  protected async customValidation(event: CharacterFindByChannelIdRequestedEvent): Promise<void> {
    // 必須フィールド検証
    validateRequired(event, ['channelId', 'source'])

    // Discord ID形式検証
    validateDiscordId(event.channelId, 'channelId')
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterFindByChannelIdRequestedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🔍 Searching character by channelId: ${event.channelId}`)

    try {
      // キャラクター検索実行
      const character = await this.characterService.findByChannelId(event.channelId)

      // 成功イベント発行（見つからない場合もnullで成功として扱う）
      await this.emitSuccessEvent(character, event, context)

      if (character) {
        this.logger.log(`✅ Character found: ${character.characterId} (${character.characterName})`)
      } else {
        this.logger.log(`ℹ️ No character found in channel: ${event.channelId}`)
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
    character: any,
    originalEvent: CharacterFindByChannelIdRequestedEvent,
    _context?: EventContext
  ): Promise<void> {
    const successEvent = {
      channelId: originalEvent.channelId,
      character,
      source: originalEvent.source,
      timestamp: new Date()
    }

    await this.typedEventService?.emit('character.findByChannelId.completed', successEvent)

    this.logger.debug(
      `📤 Success event emitted: character.findByChannelId.completed for channel ${originalEvent.channelId}`
    )
  }

  /**
   * 失敗イベントの発行
   */
  private async emitFailureEvent(
    error: Error,
    originalEvent: CharacterFindByChannelIdRequestedEvent,
    _context?: EventContext
  ): Promise<void> {
    const failureEvent = {
      channelId: originalEvent.channelId,
      error: error.message,
      source: originalEvent.source,
      timestamp: new Date()
    }

    await this.typedEventService?.emit('character.findByChannelId.failed', failureEvent)

    this.logger.error(`📤 Failure event emitted: character.findByChannelId.failed - ${error.message}`)
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
