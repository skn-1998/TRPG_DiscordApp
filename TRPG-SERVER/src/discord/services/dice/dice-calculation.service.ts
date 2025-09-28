import { Injectable, Logger } from '@nestjs/common'
import { ChannelType, TextChannel } from 'discord.js'
import { CharacterService } from 'src/domains/character/character.service'
import { Character } from 'src/domains/character/models/character.model'
import { AttributeValue, getDisplayNumber } from 'src/core/types/attribute.types'
import dice from 'src/discord/utils/dice'

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

export interface FlexibleDiceResult {
  originalFormula: string
  processedFormula: string
  diceCommand: string
  result: number
  description: string
  characterUsed?: boolean
}

@Injectable()
export class DiceCalculationService {
  private readonly logger = new Logger(DiceCalculationService.name)

  constructor(private readonly characterService: CharacterService) {
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
    character?: Character
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
      const diceResult = dice(`${targetValue}b10`)

      return {
        success: true,
        targetValue,
        diceResult,
        description,
        characterName
      }
    } catch (error) {
      this.logger.error('計算エラー:', error)
      return {
        success: false,
        description: `計算エラー: ${formula}`,
        characterName
      }
    }
  }

  /**
   * 柔軟ダイス計算式のパースと実行
   * 旧 flexible-dice-calculator.service.ts の parseAndCalculate メソッド
   */
  async parseAndCalculate(
    formula: string,
    multiplier: number = 1,
    modifier: number = 0,
    character?: Character
  ): Promise<FlexibleDiceResult> {
    const originalFormula = formula
    let processedFormula = formula.toLowerCase().trim()
    let characterUsed = false
    let description = originalFormula

    try {
      // キャラクターデータを使用した計算式の処理
      if (character) {
        const characterSubstitution = this.substituteCharacterValues(processedFormula, character)
        processedFormula = characterSubstitution.formula
        characterUsed = characterSubstitution.characterUsed
        description = characterSubstitution.description
      }

      // 乗数と修正値を適用
      if (multiplier !== 1 || modifier !== 0) {
        const finalFormula = this.applyMultiplierAndModifier(processedFormula, multiplier, modifier)
        processedFormula = finalFormula.formula
        description = finalFormula.description
      }

      // 計算実行
      const result = this.evaluateFormula(processedFormula)

      return {
        originalFormula,
        processedFormula,
        diceCommand: `${result}b10`,
        result,
        description,
        characterUsed
      }
    } catch (error) {
      this.logger.error('柔軟ダイス計算エラー:', error)
      return {
        originalFormula,
        processedFormula,
        diceCommand: '1b10',
        result: 1,
        description: `計算エラー: ${originalFormula}`,
        characterUsed
      }
    }
  }

  /**
   * 計算式を解析してキャラクター値を適用
   */
  private parseFormula(formula: string, character?: Character): { value: number; description: string } {
    // 基本的な数値の場合
    const numericValue = parseInt(formula)
    if (!isNaN(numericValue)) {
      return { value: numericValue, description: formula }
    }

    // キャラクターパラメータの場合
    if (character) {
      const substitution = this.substituteCharacterValues(formula, character)
      const value = this.evaluateFormula(substitution.formula)
      return { value, description: substitution.description }
    }

    // デフォルト値
    return { value: 1, description: formula }
  }

  /**
   * キャラクター値の置換処理
   */
  private substituteCharacterValues(
    formula: string,
    character: Character
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
      dodge: 'dodge'
    }

    for (const [key, param] of Object.entries(parameterMappings)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      if (processedFormula.match(regex)) {
        let value = 0

        if (param === 'dodge') {
          value = this.extractNumericValue(character.skill?.dodge) || 0
        } else {
          value = this.extractNumericValue(character.parameter?.[param as keyof typeof character.parameter]) || 0
        }

        processedFormula = processedFormula.replace(regex, value.toString())
        description = description.replace(regex, `${param}(${value})`)
        characterUsed = true
      }
    }

    return { formula: processedFormula, description, characterUsed }
  }

  /**
   * 乗数と修正値の適用
   */
  private applyMultiplierAndModifier(
    formula: string,
    multiplier: number,
    modifier: number
  ): { formula: string; description: string } {
    let finalFormula = formula
    let description = formula

    if (multiplier !== 1) {
      finalFormula = `(${finalFormula}) * ${multiplier}`
      description += ` × ${multiplier}`
    }

    if (modifier !== 0) {
      const sign = modifier >= 0 ? '+' : ''
      finalFormula = `(${finalFormula}) ${sign} ${modifier}`
      description += ` ${sign}${modifier}`
    }

    return { formula: finalFormula, description }
  }

  /**
   * 数式の評価
   */
  private evaluateFormula(formula: string): number {
    try {
      // 安全な数式評価（基本的な演算のみ）
      const sanitized = formula.replace(/[^0-9+\-*/().\s]/g, '')
      return Function('"use strict"; return (' + sanitized + ')')()
    } catch (error) {
      this.logger.error('数式評価エラー:', error)
      return 1
    }
  }

  /**
   * 結果の絵文字取得
   */
  getResultEmoji(diceResult: any, rollResult: number): string {
    if (!diceResult || !diceResult.rands) return '🎲'

    const diceCount = diceResult.rands.length
    const successCount = diceResult.rands.filter((roll: number[]) => roll[0] <= rollResult).length

    if (successCount === 0) return '💥' // ファンブル
    if (successCount === diceCount) return '✨' // 大成功
    if (successCount >= diceCount * 0.8) return '🎯' // 成功
    return '🎲' // 通常
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
  private extractNumericValue(value: AttributeValue | undefined): number {
    if (!value) return 0
    return getDisplayNumber(value)
  }
}
