import { Injectable } from '@nestjs/common'
import { EventHandler, EventContext, ValidationError, BusinessLogicError } from './_shared/event-handler.base'
import { validateRequired, validateStringLength, validateDiscordId } from './_shared/validation.utils'
import { CharacterCreationCoreService } from '../../domains/character/services/character-creation-core.service'
import { CharacterCreationRequestedEvent } from '../contracts/unified-event-contracts'

/**
 * character.creation.requested 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター作成リクエストの処理（入力形検証・featureId ルーティング）
 * - ビジネス中核（重複チェック・パラメータ検証・ID採番・作成）は
 *   CharacterCreationCoreService（domain）へ委譲
 * - 成功イベント（character.creation.completed）の発行
 *
 * 注: character.creation.failed の emit は恒常購読者ゼロの dead チェーンだったため
 *     E-3a で撤去した。失敗時はログ＋再スローし、EventHandler 基底のリトライ/統計に委ねる。
 */
@Injectable()
export class CharacterCreationRequestedHandler extends EventHandler<CharacterCreationRequestedEvent> {
  constructor(private readonly creationCore: CharacterCreationCoreService) {
    super()
  }

  /**
   * 処理するイベント名
   */
  getEventName(): string {
    return 'character.creation.requested'
  }

  /**
   * カスタムバリデーション
   */
  protected async customValidation(event: CharacterCreationRequestedEvent): Promise<void> {
    // 必須フィールド検証
    validateRequired(event, ['createData', 'source'])
    validateRequired(event.createData, ['characterName']) // gameSystemIdは必須ではない

    // 文字列長検証
    validateStringLength(event.createData.characterName, 'characterName', 1, 100)
    // descriptionはRecord<string, any>型なので文字列検証はスキップ

    // Discord ID検証（存在する場合）
    if (event.createData.discordChannelId) {
      validateDiscordId(event.createData.discordChannelId, 'discordChannelId')
    }
    if (event.createData.discordUserId) {
      validateDiscordId(event.createData.discordUserId, 'discordUserId')
    }

    // 注: ビジネスロジック検証（重複チェック・ゲームシステム別パラメータ検証）は
    //     CharacterCreationCoreService.createValidated（domain）へ移設した。
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterCreationRequestedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🎭 Processing character creation: ${event.createData.characterName}`)

    try {
      // featureId判定
      const featureId = event.requester?.featureId || 'characterEdit'

      this.logger.debug(`Routing to feature: ${featureId}`)

      // feature別処理
      let character
      switch (featureId) {
        case 'characterEdit':
          character = await this.handleCharacterEditCreation(event, context)
          break

        case 'characterThread':
          character = await this.handleCharacterThreadCreation(event, context)
          break

        case 'gameSystem':
          character = await this.handleGameSystemCreation(event, context)
          break

        case 'diceRoll':
          character = await this.handleDiceRollCreation(event, context)
          break

        default:
          this.logger.warn(`Unknown featureId: ${featureId}, using characterEdit fallback`)
          character = await this.handleCharacterEditCreation(event, context)
      }

      // 成功イベント発行
      await this.emitSuccessEvent(character, event, context)
    } catch (error) {
      // 注: character.creation.failed の emit は購読者ゼロのため E-3a で撤去。
      //     再スローにより EventHandler 基底のリトライ/統計がそのまま機能する。
      this.logger.error(`Character creation failed: ${(error as Error).message}`)
      throw error // エラーを再スロー
    }
  }

  /**
   * CharacterEdit Feature向け処理
   */
  private async handleCharacterEditCreation(event: CharacterCreationRequestedEvent, _context?: EventContext) {
    this.logger.debug('Handling CharacterEdit creation')

    // ビジネス中核（重複チェック・パラメータ検証・ID採番・作成）は domain サービスへ委譲
    return this.creationCore.createValidated(event.createData, event.characterId)
  }

  /**
   * CharacterThread Feature向け処理（将来実装）
   */
  private async handleCharacterThreadCreation(event: CharacterCreationRequestedEvent, context?: EventContext) {
    this.logger.debug('Handling CharacterThread creation')

    // TODO: 将来のCharacterThread機能実装時に追加
    // 現在はCharacterEdit処理にフォールバック
    this.logger.warn('CharacterThread feature not implemented yet, falling back to CharacterEdit')
    return this.handleCharacterEditCreation(event, context)
  }

  /**
   * GameSystem Feature向け処理（将来実装）
   */
  private async handleGameSystemCreation(event: CharacterCreationRequestedEvent, context?: EventContext) {
    this.logger.debug('Handling GameSystem creation')

    // TODO: 将来のGameSystem機能実装時に追加
    // 現在はCharacterEdit処理にフォールバック
    this.logger.warn('GameSystem feature not implemented yet, falling back to CharacterEdit')
    return this.handleCharacterEditCreation(event, context)
  }

  /**
   * DiceRoll Feature向け処理（将来実装）
   */
  private async handleDiceRollCreation(event: CharacterCreationRequestedEvent, context?: EventContext) {
    this.logger.debug('Handling DiceRoll creation')

    // TODO: 将来のDiceRoll機能実装時に追加
    // 現在はCharacterEdit処理にフォールバック
    this.logger.warn('DiceRoll feature not implemented yet, falling back to CharacterEdit')
    return this.handleCharacterEditCreation(event, context)
  }

  /**
   * 成功イベントの発行
   */
  private async emitSuccessEvent(
    character: any,
    originalEvent: CharacterCreationRequestedEvent,
    _context?: EventContext
  ): Promise<void> {
    const successEvent = {
      character,
      source: originalEvent.source,
      timestamp: new Date()
    }

    await this.typedEventService?.emit('character.creation.completed', successEvent)

    this.logger.log(`📤 Success event emitted: character.creation.completed for ${character.characterId}`)
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
    return 2 // キャラクター作成は最大2回リトライ
  }
}
