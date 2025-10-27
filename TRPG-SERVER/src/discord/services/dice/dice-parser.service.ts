import { Injectable, Logger } from '@nestjs/common'
import { Character } from 'src/domains/character/models/character.model'
import { AttributeValue, getDisplayNumber } from 'src/core/types/attribute.types'

/**
 * ダイス数式解析サービス
 * 旧 flexible-dice-calculator.service.ts のパーサー部分を移行
 */

export interface ParsedFormula {
  originalFormula: string
  processedFormula: string
  description: string
  characterUsed: boolean
  isValid: boolean
  errorMessage?: string
}

@Injectable()
export class DiceParserService {
  private readonly logger = new Logger(DiceParserService.name)

  constructor() {
    this.logger.debug('Dice Parser Service initialized')
  }

  /**
   * ダイス数式の解析とキャラクター値代入
   */
  parseFormula(formula: string, character?: Character, multiplier: number = 1, modifier: number = 0): ParsedFormula {
    const originalFormula = formula
    let processedFormula = formula.toLowerCase().trim()
    let description = originalFormula
    let characterUsed = false

    try {
      // 入力値の検証
      if (!this.validateFormula(formula)) {
        return {
          originalFormula,
          processedFormula,
          description,
          characterUsed,
          isValid: false,
          errorMessage: '無効な数式です'
        }
      }

      // キャラクター値の代入
      if (character) {
        const substitution = this.substituteCharacterValues(processedFormula, character)
        processedFormula = substitution.formula
        description = substitution.description
        characterUsed = substitution.characterUsed
      }

      // 乗数と修正値の適用
      if (multiplier !== 1 || modifier !== 0) {
        const modifiedFormula = this.applyModifiers(processedFormula, multiplier, modifier)
        processedFormula = modifiedFormula.formula
        description = modifiedFormula.description
      }

      // 最終検証
      if (!this.validateProcessedFormula(processedFormula)) {
        return {
          originalFormula,
          processedFormula,
          description,
          characterUsed,
          isValid: false,
          errorMessage: '処理後の数式が無効です'
        }
      }

      return {
        originalFormula,
        processedFormula,
        description,
        characterUsed,
        isValid: true
      }
    } catch (error) {
      this.logger.error('数式解析エラー:', error)
      return {
        originalFormula,
        processedFormula,
        description,
        characterUsed,
        isValid: false,
        errorMessage: `解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
      }
    }
  }

  /**
   * 入力数式の基本検証
   */
  private validateFormula(formula: string): boolean {
    if (!formula || formula.trim().length === 0) return false
    if (formula.length > 100) return false // 長すぎる数式を拒否

    // 危険な文字列をチェック
    const dangerousPatterns = [
      /eval\s*\(/i,
      /function\s*\(/i,
      /console\./i,
      /process\./i,
      /require\s*\(/i,
      /import\s+/i,
      /export\s+/i
    ]

    return !dangerousPatterns.some((pattern) => pattern.test(formula))
  }

  /**
   * 処理後数式の検証
   */
  private validateProcessedFormula(formula: string): boolean {
    // 数値、演算子、括弧のみを許可
    const allowedPattern = /^[0-9+\-*/().\s]+$/
    return allowedPattern.test(formula)
  }

  /**
   * キャラクター値の置換
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
      dodge: 'dodge',
      回避: 'dodge',

      // 日本語パラメータ対応
      筋力: 'STR',
      体力: 'CON',
      意志力: 'POW',
      敏捷性: 'DEX',
      外見: 'APP',
      体格: 'SIZ',
      知能: 'INT',
      教育: 'EDU'
    }

    // パラメータ置換処理
    for (const [key, param] of Object.entries(parameterMappings)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      if (processedFormula.match(regex)) {
        let value = 0

        if (param === 'dodge') {
          value = this.extractNumericValue(character.skill?.dodge) || 0
        } else {
          value = this.extractNumericValue(character.parameter?.[param]) || 0
        }

        processedFormula = processedFormula.replace(regex, value.toString())
        description = description.replace(regex, `${param}(${value})`)
        characterUsed = true
      }
    }

    // 特殊計算パターンの処理
    processedFormula = this.processSpecialPatterns(processedFormula, character)

    return { formula: processedFormula, description, characterUsed }
  }

  /**
   * 特殊計算パターンの処理
   */
  private processSpecialPatterns(formula: string, character: Character): string {
    // 半分計算: str/2, pow*0.5 など
    formula = formula.replace(/(\d+)\s*\/\s*2/g, (match, num) => {
      const value = parseInt(num)
      return Math.floor(value / 2).toString()
    })

    // DB計算（ダメージボーナス）
    if (formula.includes('db') || formula.includes('ダメージボーナス')) {
      const str = this.extractNumericValue(character.parameter?.STR) || 0
      const siz = this.extractNumericValue(character.parameter?.SIZ) || 0
      const db = this.calculateDamageBonus(str, siz)
      formula = formula.replace(/\bdb\b|ダメージボーナス/gi, db.toString())
    }

    return formula
  }

  /**
   * ダメージボーナスの計算
   */
  private calculateDamageBonus(str: number, siz: number): number {
    const total = str + siz
    if (total <= 12) return -2
    if (total <= 16) return -1
    if (total <= 24) return 0
    if (total <= 32) return 1
    if (total <= 40) return 2
    if (total <= 56) return 3
    if (total <= 72) return 4
    return Math.floor((total - 56) / 16) + 4
  }

  /**
   * 乗数と修正値の適用
   */
  private applyModifiers(
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
   * 数式の評価（安全な評価）
   */
  evaluateFormula(formula: string): number {
    try {
      // 安全な数式評価（基本的な演算のみ）
      const sanitized = formula.replace(/[^0-9+\-*/().\s]/g, '')
      if (sanitized !== formula) {
        throw new Error('数式に不正な文字が含まれています')
      }

      const result = Function('"use strict"; return (' + sanitized + ')')()

      // 結果の妥当性チェック
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('計算結果が無効です')
      }

      // 範囲チェック
      if (result < 0 || result > 10000) {
        throw new Error('計算結果が範囲外です')
      }

      return Math.round(result)
    } catch (error) {
      this.logger.error('数式評価エラー:', error)
      return 1
    }
  }

  /**
   * ダイス記法の変換
   */
  convertToDiceNotation(value: number): string {
    if (value <= 0) return '1b10'
    if (value > 100) return '100b10'
    return `${value}b10`
  }

  /**
   * AttributeValueから数値を抽出
   */
  private extractNumericValue(value: AttributeValue | undefined): number {
    if (!value) return 0
    return getDisplayNumber(value)
  }
}
