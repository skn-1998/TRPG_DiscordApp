import { Injectable, Logger } from '@nestjs/common'
import { ChannelType, TextChannel } from 'discord.js'
import { CharacterEntity } from 'src/domains/character/models/character.entity'
import { AttributeValue, getDisplayNumber } from 'src/core/types/attribute.types'
import dice from 'src/domains/dice-roll/services/bcdice.util'
import { UnsupportedDiceNotationError } from 'src/domains/dice-roll/services/dice-execution.service'
import { evaluateArithmetic } from '../../../shared/utils/arithmetic-evaluator.util'

/**
 * 統一されたダイス計算処理サービス
 * dice-calculation-handler.service.ts と flexible-dice-calculator.service.ts を統合
 */

export interface DiceCalculationResult {
  success: boolean
  targetValue?: number
  diceResult?: any
  description: string
  characterName: string
}

// BCDice が一度に生成する乱数件数を兄弟入口で統一し、算術式からの負荷制限迂回を防ぐ。
export const MAX_DICE_COUNT = 100

@Injectable()
export class DiceCalculationService {
  private readonly logger = new Logger(DiceCalculationService.name)

  constructor() {
    this.logger.debug('Dice Calculation Service initialized')
  }

  /**
   * キャラクターデータから実際の値を計算してダイスロール実行
   * 旧 dice-calculation-handler.service.ts の calculateAndRoll メソッド
   */
  async calculateAndRoll(
    formula: string,
    multiplier: number = 1,
    modifier: number = 0,
    character?: CharacterEntity
  ): Promise<DiceCalculationResult> {
    let characterName = 'プレイヤー'
    if (character) {
      characterName = character.characterName || characterName
    }

    try {
      // 計算式をパースして値を取得
      const calculationResult = this.parseFormula(formula, character)

      // 乗数と修正値を適用
      const targetValue = calculationResult.value * multiplier + modifier

      if (!Number.isInteger(targetValue) || targetValue <= 0 || targetValue > MAX_DICE_COUNT) {
        throw new UnsupportedDiceNotationError(
          `ダイス個数として使えない値です: ${targetValue}（上限: ${MAX_DICE_COUNT}）`
        )
      }

      let description = calculationResult.description
      if (multiplier !== 1) {
        description += ` × ${multiplier}`
      }
      if (modifier !== 0) {
        const sign = modifier >= 0 ? '+' : ''
        description += ` ${sign}${modifier}`
      }
      description += ` = ${targetValue}`

      // ダイスロール実行
      const diceResult = await dice(`${targetValue}b10`)

      if (!diceResult) {
        return {
          success: false,
          description: `ダイスロール実行失敗: ${targetValue}b10`,
          characterName
        }
      }

      return {
        success: true,
        targetValue,
        diceResult,
        description,
        characterName
      }
    } catch (error) {
      if (error instanceof UnsupportedDiceNotationError) {
        this.logger.warn(`Dice formula rejected: ${error.message}`)
      } else {
        this.logger.error('計算エラー:', error)
      }
      return {
        success: false,
        description: error instanceof UnsupportedDiceNotationError ? error.message : `計算エラー: ${formula}`,
        characterName
      }
    }
  }

  /**
   * 計算式を解析してキャラクター値を適用
   */
  private parseFormula(formula: string, character?: CharacterEntity): { value: number; description: string } {
    const substitution = this.substituteCharacterValues(formula, character)
    const normalizedFormula = this.normalizeArithmeticOperators(substitution.formula)
    const value = this.evaluateFormula(normalizedFormula, formula)
    return { value, description: substitution.description }
  }

  /**
   * キャラクター値の置換処理
   */
  private substituteCharacterValues(
    formula: string,
    character?: CharacterEntity
  ): { formula: string; description: string; characterUsed: boolean } {
    let processedFormula = formula
    let description = formula
    let characterUsed = false

    // パラメータマッピング
    const parameterMappings: Record<string, string> = {
      // 基本パラメータ
      str: 'STR',
      strength: 'STR',
      con: 'CON',
      constitution: 'CON',
      pow: 'POW',
      power: 'POW',
      dex: 'DEX',
      dexterity: 'DEX',
      app: 'APP',
      appearance: 'APP',
      siz: 'SIZ',
      size: 'SIZ',
      int: 'INT',
      intelligence: 'INT',
      edu: 'EDU',
      education: 'EDU',
      hp: 'HP',
      mp: 'MP',

      // 技能
      dodge: '回避'
    }

    for (const [key, param] of Object.entries(parameterMappings)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      if (processedFormula.match(regex)) {
        const candidateNames = [key, param]
        const value = character ? this.resolveCharacterValue(character, candidateNames) : undefined
        if (value === undefined) {
          throw new UnsupportedDiceNotationError(`キャラクターに ${param} が見つかりません`)
        }

        processedFormula = processedFormula.replace(regex, `(${value})`)
        description = description.replace(regex, `${param}(${value})`)
        characterUsed = true
      }
    }

    return { formula: processedFormula, description, characterUsed }
  }

  /**
   * 全角の乗除算記号を、評価器が受け取る演算子へ正規化する。
   * `×` は入力例で案内されている。`÷` は対称性のため同時に受け入れる。
   */
  private normalizeArithmeticOperators(formula: string): string {
    return formula.replace(/×/g, '*').replace(/÷/g, '/')
  }

  /**
   * 許可された文字だけで構成された数式を評価する。
   * 未対応文字は削除せず、元の入力を示す UnsupportedDiceNotationError として拒否する。
   * ダイス記法用の DiceOrchestratorService.validateDiceNotation とは別入口の別検証で、`2d6` はここでは拒否する。
   */
  private evaluateFormula(formula: string, sourceFormula: string): number {
    if (!formula.trim() || !/^[0-9+\-*/().\s]+$/.test(formula)) {
      throw new UnsupportedDiceNotationError(`未対応のダイス記法です: ${sourceFormula}`)
    }

    try {
      return evaluateArithmetic(formula)
    } catch {
      throw new UnsupportedDiceNotationError(`未対応のダイス記法です: ${sourceFormula}`)
    }
  }

  /**
   * BCDice の判定フラグだけを結果絵文字へ変換する。
   *
   * 現行の2入口はいずれも BCDice の判定フラグを立てないため、実質 🎲 固定である。
   * executeBasicNotation の validateDiceNotation は `NdM±K` のみを許可し、
   * calculateAndRoll は `Nb10` のバラバラダイスを実行する。
   * 成功/失敗表示を復活させるには validateDiceNotation の緩和が前提となる。
   */
  getResultEmoji(diceResult: any): string {
    if (diceResult?.critical) return '🌟'
    if (diceResult?.fumble) return '💥'
    if (diceResult?.success) return '✅'
    if (diceResult?.failure) return '❌'
    return '🎲'
  }

  /**
   * 親チャンネルへの送信
   */
  async sendToParentChannel(interaction: any, message: string): Promise<void> {
    try {
      if (interaction.channel?.type === ChannelType.PublicThread && interaction.channel.parent) {
        const parentChannel = interaction.channel.parent as TextChannel
        await parentChannel.send(message)
      }
    } catch (error) {
      this.logger.error('親チャンネル送信エラー:', error)
    }
  }

  /**
   * AttributeValueから数値を抽出
   */
  private extractNumericValue(value: AttributeValue | undefined): number | undefined {
    if (!value?.values || Object.keys(value.values).length === 0) return undefined
    return getDisplayNumber(value)
  }

  /**
   * parameter → status → skill の順で、表記揺れを正規化してキャラクター値を解決する。
   */
  private resolveCharacterValue(character: CharacterEntity, candidateNames: readonly string[]): number | undefined {
    const normalizedCandidates = new Set(
      candidateNames.map((candidateName) => this.normalizeCharacterKey(candidateName))
    )
    const sections = [character.parameter, character.status, character.skill]

    for (const section of sections) {
      // 旧キャラは保存キー(dodge)と表示名(回避)が分かれるため、キーと name の両方を照合する。
      const matchedAttribute = Object.entries(section ?? {}).find(([key, attribute]) => {
        const normalizedAttributeName = this.normalizeCharacterKey(attribute.name ?? '')
        return (
          normalizedCandidates.has(this.normalizeCharacterKey(key)) ||
          (normalizedAttributeName.length > 0 && normalizedCandidates.has(normalizedAttributeName))
        )
      })?.[1]
      const value = this.extractNumericValue(matchedAttribute)
      if (value !== undefined) {
        return value
      }
    }

    return undefined
  }

  /**
   * 大文字小文字・全半角・空白・記号の違いをキャラクターキーの照合から除外する。
   */
  private normalizeCharacterKey(key: string): string {
    return key
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]/gu, '')
  }
}
