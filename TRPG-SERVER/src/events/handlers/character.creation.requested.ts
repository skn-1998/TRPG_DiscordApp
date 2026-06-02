import { Injectable } from '@nestjs/common'
import { EventHandler, EventContext, ValidationError, BusinessLogicError } from './_shared/event-handler.base'
import { validateRequired, validateStringLength, validateDiscordId } from './_shared/validation.utils'
import { CharacterService } from '../../domains/character/character.service'
import { CharacterIdService } from '../../domains/character/services/character-id.service'
import { CharacterCreationRequestedEvent, CharacterCreationData } from '../contracts/unified-event-contracts'

/**
 * character.creation.requested 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター作成リクエストの処理
 * - featureId判定とルーティング
 * - 各Feature向けの適切な処理実行
 * - 成功・失敗イベントの発行
 */
@Injectable()
export class CharacterCreationRequestedHandler extends EventHandler<CharacterCreationRequestedEvent> {
  constructor(
    private readonly characterService: CharacterService,
    private readonly characterIdService: CharacterIdService
  ) {
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

    // ビジネスロジック検証
    await this.validateBusinessLogic(event.createData)
  }

  /**
   * ビジネスロジック検証
   */
  private async validateBusinessLogic(createData: CharacterCreationData): Promise<void> {
    // キャラクター名重複チェック（チャンネル内）
    if (createData.discordChannelId) {
      const existingCharacter = await this.characterService.findByChannelId(createData.discordChannelId)
      if (existingCharacter) {
        throw new BusinessLogicError(
          `Character already exists in channel: ${createData.discordChannelId}`,
          'CHARACTER_ALREADY_EXISTS'
        )
      }
    }

    // パラメータ構造の検証（gameSystemIdが存在する場合のみ）
    if (createData.parameter && createData.gameSystemId) {
      this.validateParameterStructure(createData.parameter, createData.gameSystemId)
    }
  }

  /**
   * ゲームシステム別パラメータ検証
   */
  private validateParameterStructure(parameter: Record<string, any>, gameSystemId: string | undefined): void {
    if (!gameSystemId) {
      // gameSystemIdが未指定の場合は検証をスキップ
      return
    }
    switch (gameSystemId) {
      case 'coc':
        this.validateCocParameters(parameter)
        break
      case 'dnd5e':
        this.validateDnd5eParameters(parameter)
        break
      case 'sw2.5':
        this.validateSw25Parameters(parameter)
        break
      case 'generic':
        // 汎用システムは構造チェックなし
        break
      default:
        throw new ValidationError(`Unsupported game system: ${gameSystemId}`)
    }
  }

  /**
   * Call of Cthulhuパラメータ検証
   */
  private validateCocParameters(parameter: Record<string, any>): void {
    const requiredStats = ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU']
    const missingStats = requiredStats.filter((stat) => !(stat in parameter))

    if (missingStats.length > 0) {
      throw new ValidationError(`CoC character missing required stats: ${missingStats.join(', ')}`)
    }

    // 能力値の範囲チェック
    requiredStats.forEach((stat) => {
      const value = parameter[stat]
      if (typeof value !== 'number' || value < 1 || value > 99) {
        throw new ValidationError(`CoC stat ${stat} must be between 1-99`)
      }
    })
  }

  /**
   * D&D 5eパラメータ検証
   */
  private validateDnd5eParameters(parameter: Record<string, any>): void {
    const requiredStats = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
    const missingStats = requiredStats.filter((stat) => !(stat in parameter))

    if (missingStats.length > 0) {
      throw new ValidationError(`D&D 5e character missing required stats: ${missingStats.join(', ')}`)
    }

    // 能力値の範囲チェック
    requiredStats.forEach((stat) => {
      const value = parameter[stat]
      if (typeof value !== 'number' || value < 3 || value > 20) {
        throw new ValidationError(`D&D 5e stat ${stat} must be between 3-20`)
      }
    })
  }

  /**
   * ソード・ワールド2.5パラメータ検証
   */
  private validateSw25Parameters(parameter: Record<string, any>): void {
    const requiredStats = ['器用度', '敏捷度', '筋力', '生命力', '知力', '精神力']
    const missingStats = requiredStats.filter((stat) => !(stat in parameter))

    if (missingStats.length > 0) {
      throw new ValidationError(`SW2.5 character missing required stats: ${missingStats.join(', ')}`)
    }
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
      // 失敗イベント発行
      await this.emitFailureEvent(error as Error, event, context)
      throw error // エラーを再スロー
    }
  }

  /**
   * CharacterEdit Feature向け処理
   */
  private async handleCharacterEditCreation(event: CharacterCreationRequestedEvent, _context?: EventContext) {
    this.logger.debug('Handling CharacterEdit creation')

    // ユニークなキャラクターIDの生成（未設定の場合）
    const characterId = event.characterId || (await this.characterIdService.generateUniqueCharacterId('char_'))

    // キャラクター作成
    const characterData = {
      ...event.createData,
      characterId,
      // description型をRecord<string, AttributeValueDto>に変換
      description: event.createData.description ? (event.createData.description as any) : undefined
    }
    const character = await this.characterService.create(characterData)

    this.logger.log(`✅ CharacterEdit creation completed: ${character.characterId}`)
    return character
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
   * 失敗イベントの発行
   */
  private async emitFailureEvent(
    error: Error,
    originalEvent: CharacterCreationRequestedEvent,
    _context?: EventContext
  ): Promise<void> {
    const failureEvent = {
      createData: {
        characterName: originalEvent.createData.characterName,
        gameSystemId: originalEvent.createData.gameSystemId || '',
        discordUserId: originalEvent.createData.discordUserId || '',
        discordChannelId: originalEvent.createData.discordChannelId,
        characterId: originalEvent.characterId || (await this.characterIdService.generateUniqueCharacterId('char_'))
      },
      error: error.message,
      source: originalEvent.source,
      timestamp: new Date()
    }

    await this.typedEventService?.emit('character.creation.failed', failureEvent)

    this.logger.error(`📤 Failure event emitted: character.creation.failed - ${error.message}`)
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
