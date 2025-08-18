import { Injectable } from '@nestjs/common'
import { EventHandler, EventContext } from './_shared/event-handler.base'
import { CharacterFindByNameRequestedEvent } from '../contracts/unified-event-contracts'
import { CharacterRepository } from '../../domains/character/repositories/character.repository'

/**
 * character.findByName.requested 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター名での検索処理
 * - 検索結果に応じた完了・失敗イベント発行
 */
@Injectable()
export class CharacterFindByNameRequestedHandler extends EventHandler<CharacterFindByNameRequestedEvent> {
  constructor(private readonly characterRepository: CharacterRepository) {
    super()
  }

  /**
   * 処理するイベント名
   */
  getEventName(): string {
    return 'character.findByName.requested'
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterFindByNameRequestedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🔍 Processing character findByName request: ${event.characterName}`)

    try {
      // キャラクター名でキャラクターを検索
      const character = (await this.characterRepository.findByName?.(event.characterName)) || null

      if (character) {
        // 成功イベント発行
        await this.typedEventService?.emit('character.findByName.completed', {
          characterName: event.characterName,
          character: character as any,
          source: event.source,
          timestamp: new Date()
        })

        this.logger.log(`✅ Character found by name: ${character.characterName}`)
      } else {
        // 見つからない場合は失敗イベント
        await this.typedEventService?.emit('character.findByName.failed', {
          characterName: event.characterName,
          error: 'Character not found',
          source: event.source,
          timestamp: new Date()
        })

        this.logger.warn(`⚠️ Character not found for name: ${event.characterName}`)
      }
    } catch (error) {
      this.logger.error(`❌ Character findByName failed: ${error instanceof Error ? error.message : String(error)}`)

      // 失敗イベント発行
      await this.typedEventService?.emit('character.findByName.failed', {
        characterName: event.characterName,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: event.source,
        timestamp: new Date()
      })

      throw error
    }
  }

  /**
   * リトライ可能エラーの判定
   */
  protected isRetryableError(error: Error): boolean {
    // データベース接続エラーなどはリトライ可能
    if (error instanceof Error && (error.message.includes('database') || error.message.includes('connection'))) {
      return true
    }
    return super.isRetryableError(error)
  }

  /**
   * 最大リトライ回数
   */
  protected getMaxRetries(): number {
    return 2 // 検索処理なので軽量、リトライ回数は少なめ
  }
}
