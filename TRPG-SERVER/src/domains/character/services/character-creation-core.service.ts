import { Injectable, Logger } from '@nestjs/common'
import { CharacterService } from '../character.service'
import { CharacterIdService } from './character-id.service'
import { CharacterEntity } from '../models/character.entity'
import { AttributeSection, getDisplayNumber, isAttributeSection } from '../../../core/types/attribute.types'

/**
 * キャラクター作成コア入力
 *
 * events 層の CharacterCreationData（unified-event-contracts）と構造互換。
 * domains→events の import 逆流を禁止しているため、ドメイン側で独立定義する
 * （構造的部分型により events 層からは createData をそのまま渡せる）。
 */
export interface CharacterCreationCoreInput {
  // characterId は本 input では受け取らない（createValidated の第2引数のみが正・型上の誤用防止）
  characterName: string
  gameSystemId?: string
  discordChannelId?: string
  discordUserId?: string
  status?: AttributeSection
  parameter?: AttributeSection
  skill?: AttributeSection
  item?: AttributeSection
  description?: AttributeSection
  profileImageUrl?: string
  createdAt?: Date
  updatedAt?: Date
}

/**
 * キャラクター作成バリデーションエラー（ドメイン版）
 *
 * events 層の ValidationError（event-handler.base）と name を揃え、
 * error.name / error.message ベースの既存ハンドリング
 * （creation.failed 発行・リトライ不可判定）の意味論を維持する。
 */
export class CharacterCreationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * キャラクター作成ビジネスロジックエラー（ドメイン版・code プロパティ付き）
 *
 * events 層の BusinessLogicError と name / code の意味論を揃える
 * （domains から events 層は import できないため等価クラスを定義）。
 */
export class CharacterCreationBusinessError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'BusinessLogicError'
  }
}

/**
 * キャラクター作成コアサービス
 *
 * 🎯 責務:
 * - キャラクター作成のビジネス中核（重複チェック → パラメータ構造検証 → ID 採番 → 作成）
 * - CharacterCreationRequestedHandler（events 層）から移設したロジックの正本
 *
 * 📋 設計原則（ARCHITECTURE §9）:
 * - domain はイベントを発行しない（通知は呼び出し側の責務）
 * - 入力形検証（文字列長・Discord ID 形式）は呼び出し側（events 層等）の責務のまま
 */
@Injectable()
export class CharacterCreationCoreService {
  private readonly logger = new Logger(CharacterCreationCoreService.name)

  constructor(
    private readonly characterService: CharacterService,
    private readonly characterIdService: CharacterIdService
  ) {}

  /**
   * ビジネス検証つきキャラクター作成
   *
   * @param createData 作成データ（events 層 CharacterCreationData と構造互換）
   * @param characterId 指定済みキャラクターID（未指定なら 'char_' プレフィックスで採番）
   * @returns 作成された CharacterEntity
   * @throws CharacterCreationBusinessError 同一チャンネルに既存キャラクターがいる場合（CHARACTER_ALREADY_EXISTS）
   * @throws CharacterCreationValidationError ゲームシステム別パラメータ構造が不正な場合
   */
  async createValidated(createData: CharacterCreationCoreInput, characterId?: string): Promise<CharacterEntity> {
    this.validateCanonicalSections(createData)

    // キャラクター重複チェック（チャンネル内）
    // 移設元: CharacterCreationRequestedHandler.validateBusinessLogic
    if (createData.discordChannelId) {
      const existingCharacter = await this.characterService.findByChannelId(createData.discordChannelId)
      if (existingCharacter) {
        throw new CharacterCreationBusinessError(
          `Character already exists in channel: ${createData.discordChannelId}`,
          'CHARACTER_ALREADY_EXISTS'
        )
      }
    }

    // パラメータ構造の検証（gameSystemIdが存在する場合のみ）
    if (createData.parameter && createData.gameSystemId) {
      this.validateParameterStructure(createData.parameter, createData.gameSystemId)
    }

    // ユニークなキャラクターIDの生成（未設定の場合）
    // 移設元: CharacterCreationRequestedHandler.handleCharacterEditCreation
    const resolvedCharacterId = characterId || (await this.characterIdService.generateUniqueCharacterId('char_'))

    // キャラクター作成
    const characterData = {
      ...createData,
      characterId: resolvedCharacterId,
      description: createData.description
    }
    const character = await this.characterService.create(characterData)

    this.logger.log(`✅ Character creation completed: ${character.characterId}`)
    return character
  }

  /**
   * 全セクションが AttributeSection の正準形であることを保証する。
   */
  private validateCanonicalSections(createData: CharacterCreationCoreInput): void {
    const sectionNames = ['status', 'parameter', 'skill', 'item', 'description'] as const

    for (const sectionName of sectionNames) {
      const section = createData[sectionName]
      if (section !== undefined && !isAttributeSection(section)) {
        throw new CharacterCreationValidationError(`Invalid ${sectionName}: expected AttributeSection canonical form`)
      }
    }
  }

  /**
   * ゲームシステム別パラメータ検証
   */
  private validateParameterStructure(parameter: AttributeSection, gameSystemId: string | undefined): void {
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
        throw new CharacterCreationValidationError(`Unsupported game system: ${gameSystemId}`)
    }
  }

  /**
   * Call of Cthulhuパラメータ検証
   */
  private validateCocParameters(parameter: AttributeSection): void {
    const requiredStats = ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU']
    const missingStats = requiredStats.filter((stat) => !Object.prototype.hasOwnProperty.call(parameter, stat))

    if (missingStats.length > 0) {
      throw new CharacterCreationValidationError(`CoC character missing required stats: ${missingStats.join(', ')}`)
    }

    // 能力値の範囲チェック
    requiredStats.forEach((stat) => {
      const value = this.getRequiredStatValue(parameter, stat, 'CoC')
      if (value < 1 || value > 99) {
        throw new CharacterCreationValidationError(`CoC stat ${stat} must be between 1-99`)
      }
    })
  }

  /**
   * D&D 5eパラメータ検証
   */
  private validateDnd5eParameters(parameter: AttributeSection): void {
    const requiredStats = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
    const missingStats = requiredStats.filter((stat) => !Object.prototype.hasOwnProperty.call(parameter, stat))

    if (missingStats.length > 0) {
      throw new CharacterCreationValidationError(`D&D 5e character missing required stats: ${missingStats.join(', ')}`)
    }

    // 能力値の範囲チェック
    requiredStats.forEach((stat) => {
      const value = this.getRequiredStatValue(parameter, stat, 'D&D 5e')
      if (value < 3 || value > 20) {
        throw new CharacterCreationValidationError(`D&D 5e stat ${stat} must be between 3-20`)
      }
    })
  }

  /**
   * ソード・ワールド2.5パラメータ検証
   */
  private validateSw25Parameters(parameter: AttributeSection): void {
    const requiredStats = ['器用度', '敏捷度', '筋力', '生命力', '知力', '精神力']
    const missingStats = requiredStats.filter((stat) => !Object.prototype.hasOwnProperty.call(parameter, stat))

    if (missingStats.length > 0) {
      throw new CharacterCreationValidationError(`SW2.5 character missing required stats: ${missingStats.join(', ')}`)
    }

    requiredStats.forEach((stat) => this.getRequiredStatValue(parameter, stat, 'SW2.5'))
  }

  /**
   * 必須能力値の values を合算し、数値が存在することを保証する。
   */
  private getRequiredStatValue(parameter: AttributeSection, stat: string, gameSystem: string): number {
    const attribute = parameter[stat]
    if (!attribute.values || Object.keys(attribute.values).length === 0) {
      throw new CharacterCreationValidationError(
        `${gameSystem} stat ${stat} must contain at least one finite numeric value part`
      )
    }

    const value = getDisplayNumber(attribute)
    if (!Number.isFinite(value)) {
      throw new CharacterCreationValidationError(`${gameSystem} stat ${stat} total must be finite`)
    }
    return value
  }
}
