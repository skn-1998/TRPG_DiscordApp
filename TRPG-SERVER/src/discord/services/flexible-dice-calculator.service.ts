import { Injectable } from '@nestjs/common'
import { Character } from 'src/domains/character/models/character.model'
import dice from 'src/discord/utils/dice'

/**
 * 柔軟ダイス計算用の結果インターフェース
 */
export interface FlexibleDiceResult {
  originalFormula: string
  processedFormula: string
  diceCommand: string
  result: number
  description: string
  characterUsed?: boolean
}

/**
 * ダイス計算式パーサーサービス
 * status*3+4, skill×2-1のような形式をサポート
 */
@Injectable()
export class FlexibleDiceCalculatorService {
  /**
   * 計算式をパースして実行可能なダイス記法に変換
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

      // ダイス記法に変換
      const diceCommand = this.convertToDiceNotation(processedFormula)

      // ダイスロール実行
      const diceResult = await dice(diceCommand, 'Cthulhu')
      if (!diceResult) {
        throw new Error('ダイスロールの実行に失敗しました')
      }

      const result = diceResult.rands.reduce((acc, curr) => acc + curr[0], 0)

      return {
        originalFormula,
        processedFormula,
        diceCommand,
        result,
        description,
        characterUsed
      }
    } catch (error) {
      throw new Error(`計算式の処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    }
  }

  /**
   * キャラクターの値を計算式に代入
   */
  private substituteCharacterValues(
    formula: string,
    character: Character
  ): {
    formula: string
    characterUsed: boolean
    description: string
  } {
    let processedFormula = formula
    let characterUsed = false
    const substitutions: string[] = []

    // status, skill, parameter の値を検索・代入
    const sections = [
      { name: 'status', data: character.status },
      { name: 'skill', data: character.skill },
      { name: 'parameter', data: character.parameter }
    ]

    for (const section of sections) {
      if (!section.data) continue

      for (const [key, value] of Object.entries(section.data)) {
        const patterns = [key.toLowerCase(), key.toLowerCase().replace(/\s+/g, ''), section.name.toLowerCase()]

        for (const pattern of patterns) {
          const regex = new RegExp(`\\b${pattern}\\b`, 'gi')
          if (regex.test(processedFormula)) {
            let numericValue: number = 0

            if (typeof value === 'object' && value && 'value' in value) {
              numericValue = Number(value.value) || 0
            } else {
              numericValue = Number(value) || 0
            }

            if (numericValue > 0) {
              processedFormula = processedFormula.replace(regex, numericValue.toString())
              characterUsed = true
              substitutions.push(`${key}=${numericValue}`)
              break
            }
          }
        }
      }
    }

    const description = substitutions.length > 0 ? `${formula} (${substitutions.join(', ')})` : formula

    return {
      formula: processedFormula,
      characterUsed,
      description
    }
  }

  /**
   * 乗数と修正値を適用
   */
  private applyMultiplierAndModifier(
    formula: string,
    multiplier: number,
    modifier: number
  ): {
    formula: string
    description: string
  } {
    let processedFormula = formula
    let description = formula

    // 乗数の適用
    if (multiplier !== 1) {
      // 数値部分に乗数を適用
      processedFormula = processedFormula.replace(/(\d+)/g, (match) => {
        const num = parseInt(match)
        return (num * multiplier).toString()
      })
      description += ` × ${multiplier}`
    }

    // 修正値の適用
    if (modifier !== 0) {
      const sign = modifier >= 0 ? '+' : ''
      processedFormula += sign + modifier.toString()
      description += ` ${sign}${modifier}`
    }

    return { formula: processedFormula, description }
  }

  /**
   * 数式をダイス記法に変換
   */
  private convertToDiceNotation(formula: string): string {
    // 既にダイス記法の場合はそのまま返す
    if (/\d+d\d+/i.test(formula)) {
      return formula
    }

    // シンプルな数値計算の場合は1d1ベースに変換
    // 例: "15+3" -> "1d1+17" (結果は18固定)
    try {
      const evaluated = eval(formula.replace(/[^0-9+\-*/.() ]/g, ''))
      if (typeof evaluated === 'number' && isFinite(evaluated)) {
        return evaluated >= 1 ? `1d1+${evaluated - 1}` : '1d1'
      }
    } catch (error) {
      // eval失敗時はフォールバック
    }

    // その他の場合は1d100として処理
    return '1d100'
  }
}
