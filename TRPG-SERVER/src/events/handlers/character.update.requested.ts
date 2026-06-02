import { Injectable } from '@nestjs/common'
import { EventHandler, EventContext, ValidationError, BusinessLogicError } from './_shared/event-handler.base'
import { validateRequired, validateStringLength } from './_shared/validation.utils'
import { CharacterService } from '../../domains/character/character.service'
import { CharacterUpdateRequestedEvent } from '../contracts/unified-event-contracts'

/**
 * character.update.requested 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター更新リクエストの処理
 * - 更新データのバリデーション
 * - 変更差分の追跡
 * - 成功・失敗イベントの発行
 */
@Injectable()
export class CharacterUpdateRequestedHandler extends EventHandler<CharacterUpdateRequestedEvent> {
  constructor(private readonly characterService: CharacterService) {
    super()
  }

  /**
   * 処理するイベント名
   */
  getEventName(): string {
    return 'character.update.requested'
  }

  /**
   * カスタムバリデーション
   */
  protected async customValidation(event: CharacterUpdateRequestedEvent): Promise<void> {
    // 必須フィールド検証
    validateRequired(event, ['updateData', 'source'])

    // characterIdまたはchannelIdのいずれかが必要
    if (!event.characterId && !event.channelId) {
      throw new ValidationError('Either characterId or channelId must be provided')
    }

    // 更新データが空でないことを確認
    if (!event.updateData || Object.keys(event.updateData).length === 0) {
      throw new ValidationError('Update data cannot be empty')
    }

    // 文字列フィールドの長さ検証
    if (event.updateData.characterName) {
      validateStringLength(event.updateData.characterName, 'characterName', 1, 100)
    }
    // descriptionはRecord<string, any>型なので文字列検証はスキップ

    // ビジネスロジック検証
    await this.validateBusinessLogic(event)
  }

  /**
   * ビジネスロジック検証
   */
  private async validateBusinessLogic(event: CharacterUpdateRequestedEvent): Promise<void> {
    // 対象キャラクターの存在確認
    let character

    if (event.characterId) {
      character = await this.characterService.findOne(event.characterId)
      if (!character) {
        throw new BusinessLogicError(`Character not found: ${event.characterId}`, 'CHARACTER_NOT_FOUND')
      }
    } else if (event.channelId) {
      character = await this.characterService.findByChannelId(event.channelId)
      if (!character) {
        throw new BusinessLogicError(
          `Character not found in channel: ${event.channelId}`,
          'CHARACTER_NOT_FOUND_IN_CHANNEL'
        )
      }
    }

    // 更新可能性チェック
    if (character) {
      await this.validateUpdatePermissions(character, event)
    }
  }

  /**
   * 更新権限の検証
   */
  private async validateUpdatePermissions(character: any, event: CharacterUpdateRequestedEvent): Promise<void> {
    // ユーザー権限チェック（Discord User IDが一致するか）
    if (event.userId && character.discordUserId && event.userId !== character.discordUserId) {
      this.logger.warn(`Update permission check failed: ${event.userId} vs ${character.discordUserId}`)
      // 権限エラーではなく警告レベルに留める（システム更新を許可）
    }

    // ゲームシステム固有の更新制限チェック（gameSystemIdは更新不可）
    // if (event.updateData.gameSystemId && event.updateData.gameSystemId !== character.gameSystemId) {
    //   throw new BusinessLogicError(
    //     'Game system cannot be changed after character creation',
    //     'GAME_SYSTEM_IMMUTABLE'
    //   )
    // }
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterUpdateRequestedEvent, context?: EventContext): Promise<void> {
    const identifier = event.characterId || event.channelId
    this.logger.log(`🔄 Processing character update: ${identifier}`)

    try {
      // 更新前のキャラクター情報取得
      const originalCharacter = await this.getOriginalCharacter(event)
      if (!originalCharacter) {
        throw new BusinessLogicError(`Character not found for update: ${identifier}`, 'CHARACTER_NOT_FOUND')
      }

      // キャラクター更新実行
      const updateData = {
        ...event.updateData,
        // description型をRecord<string, AttributeValueDto>に変換
        description: event.updateData.description ? (event.updateData.description as any) : undefined
      }

      let updatedCharacter
      if (event.characterId) {
        updatedCharacter = await this.characterService.update(event.characterId, updateData)
      } else {
        updatedCharacter = await this.characterService.updateByChannelId(event.channelId!, updateData)
      }

      if (!updatedCharacter) {
        throw new BusinessLogicError('Character update failed', 'UPDATE_FAILED')
      }

      // 変更差分の計算
      const changes = this.calculateChanges(originalCharacter, updatedCharacter)

      // 成功イベント発行
      await this.emitSuccessEvent(updatedCharacter, changes, event, context)

      this.logger.log(`✅ Character update completed: ${updatedCharacter.characterId}`)
    } catch (error) {
      // 失敗イベント発行
      await this.emitFailureEvent(error as Error, event, context)
      throw error
    }
  }

  /**
   * 更新前キャラクター情報の取得
   */
  private async getOriginalCharacter(event: CharacterUpdateRequestedEvent) {
    if (event.characterId) {
      return await this.characterService.findOne(event.characterId)
    } else if (event.channelId) {
      return await this.characterService.findByChannelId(event.channelId)
    }
    return null
  }

  /**
   * 変更差分の計算
   */
  private calculateChanges(original: any, updated: any): Array<{ field: string; oldValue: any; newValue: any }> {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = []

    // 比較対象フィールド
    const fieldsToCompare = ['characterName', 'description', 'status', 'parameter', 'skill', 'item', 'profileImageUrl']

    fieldsToCompare.forEach((field) => {
      const oldValue = original[field]
      const newValue = updated[field]

      // 深い比較（オブジェクトの場合）
      if (this.hasChanged(oldValue, newValue)) {
        changes.push({
          field,
          oldValue: this.cloneValue(oldValue),
          newValue: this.cloneValue(newValue)
        })
      }
    })

    return changes
  }

  /**
   * 値の変更判定
   */
  private hasChanged(oldValue: any, newValue: any): boolean {
    // 両方undefinedまたはnullの場合は変更なし
    if (oldValue == null && newValue == null) {
      return false
    }

    // 一方だけnullの場合は変更あり
    if ((oldValue == null) !== (newValue == null)) {
      return true
    }

    // オブジェクトの場合は深い比較
    if (typeof oldValue === 'object' && typeof newValue === 'object') {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue)
    }

    // プリミティブ値の比較
    return oldValue !== newValue
  }

  /**
   * 値の安全なクローン
   */
  private cloneValue(value: any): any {
    if (value == null) {
      return value
    }

    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value))
      } catch {
        return value
      }
    }

    return value
  }

  /**
   * 成功イベントの発行
   */
  private async emitSuccessEvent(
    character: any,
    changes: Array<{ field: string; oldValue: any; newValue: any }>,
    originalEvent: CharacterUpdateRequestedEvent,
    _context?: EventContext
  ): Promise<void> {
    const successEvent = {
      channelId: originalEvent.channelId || character.discordChannelId || '',
      character,
      source: originalEvent.source,
      timestamp: new Date()
    }

    await this.typedEventService?.emit('character.update.completed', successEvent)

    this.logger.log(`📤 Success event emitted: character.update.completed for ${character.characterId}`)
  }

  /**
   * 失敗イベントの発行
   */
  private async emitFailureEvent(
    error: Error,
    originalEvent: CharacterUpdateRequestedEvent,
    _context?: EventContext
  ): Promise<void> {
    const failureEvent = {
      channelId: originalEvent.channelId || '',
      error: error.message,
      source: originalEvent.source,
      timestamp: new Date()
    }

    await this.typedEventService?.emit('character.update.failed', failureEvent)

    this.logger.error(`📤 Failure event emitted: character.update.failed - ${error.message}`)
  }

  /**
   * リトライ可能エラーの判定（オーバーライド）
   */
  protected isRetryableError(error: Error): boolean {
    // ビジネスロジックエラーはリトライしない
    if (error instanceof BusinessLogicError || error instanceof ValidationError) {
      return false
    }

    // 親クラスの判定を使用
    return super.isRetryableError(error)
  }

  /**
   * 最大リトライ回数（オーバーライド）
   */
  protected getMaxRetries(): number {
    return 2 // キャラクター更新は最大2回リトライ
  }
}
