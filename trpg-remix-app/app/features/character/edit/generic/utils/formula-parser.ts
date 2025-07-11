// 数式解析機能

import { ParseResult, DiceResult } from '../types'

export class FormulaParser {
  // 参照パターン: [セル名] または [セル名:セル名]
  private static readonly REFERENCE_PATTERN = /\[([A-Za-z0-9_-]+)\]/g

  /**
   * 数式を解析して参照セルと計算式を抽出
   */
  parseFormula(formula: string): ParseResult {
    try {
      const references: string[] = []
      const matches = formula.matchAll(FormulaParser.REFERENCE_PATTERN)
      
      for (const match of matches) {
        const cellName = match[1]
        if (!references.includes(cellName)) {
          references.push(cellName)
        }
      }
      
      // [セル名] を変数名に置換
      const expression = formula.replace(
        FormulaParser.REFERENCE_PATTERN,
        (match, cellName) => cellName
      )
      
      return {
        references,
        expression,
        isValid: true
      }
    } catch (error) {
      return {
        references: [],
        expression: formula,
        isValid: false,
        error: error instanceof Error ? error.message : '数式解析エラー'
      }
    }
  }

  /**
   * 参照を実際の値に置換して計算を実行
   */
  calculateFormula(formula: string, values: Map<string, number>): number {
    try {
      const parseResult = this.parseFormula(formula)
      
      if (!parseResult.isValid) {
        throw new Error(parseResult.error || '無効な数式です')
      }
      
      let expression = parseResult.expression
      
      // 参照を実際の値に置換
      for (const reference of parseResult.references) {
        const value = values.get(reference)
        if (value === undefined) {
          throw new Error(`参照されたセル "${reference}" が見つかりません`)
        }
        
        // 変数名を値に置換
        expression = expression.replace(
          new RegExp(`\\b${reference}\\b`, 'g'),
          value.toString()
        )
      }
      
      // 数式を評価（eval の安全な代替）
      return this.evaluateExpression(expression)
    } catch (error) {
      throw new Error(`計算エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
    }
  }

  /**
   * 循環参照をチェック
   */
  checkCircularReference(dependencies: Map<string, string[]>): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const hasCycle = (cellId: string): boolean => {
      if (recursionStack.has(cellId)) {
        return true
      }
      if (visited.has(cellId)) {
        return false
      }

      visited.add(cellId)
      recursionStack.add(cellId)

      const deps = dependencies.get(cellId) || []
      for (const dep of deps) {
        if (hasCycle(dep)) {
          return true
        }
      }

      recursionStack.delete(cellId)
      return false
    }

    for (const cellId of dependencies.keys()) {
      if (hasCycle(cellId)) {
        return true
      }
    }

    return false
  }

  /**
   * 安全な数式評価
   */
  private evaluateExpression(expression: string): number {
    // 許可される演算子と数値のみを含む式かチェック
    const safePattern = /^[\d+\-*/().[\] ]+$/
    if (!safePattern.test(expression)) {
      throw new Error('無効な文字が含まれています')
    }

    // 基本的な数式評価（eval を使わない方法）
    try {
      // シンプルな四則演算の評価
      return Function(`"use strict"; return (${expression})`)()
    } catch (error) {
      throw new Error('数式の評価に失敗しました')
    }
  }
}

export class DiceParser {
  // ダイス記法パターン: 1d6, 2d10+5 など
  private static readonly DICE_PATTERN = /(\d+)d(\d+)([+\-]\d+)?/g

  /**
   * ダイス記法を解析
   */
  parseDiceNotation(notation: string): DiceResult {
    const matches = Array.from(notation.matchAll(DiceParser.DICE_PATTERN))
    
    if (matches.length === 0) {
      throw new Error('有効なダイス記法ではありません')
    }

    const rolls: number[] = []
    let total = 0
    let modifier = 0

    for (const match of matches) {
      const diceCount = parseInt(match[1])
      const diceSize = parseInt(match[2])
      const mod = match[3] ? parseInt(match[3]) : 0

      if (diceCount <= 0 || diceSize <= 0) {
        throw new Error('ダイス数とダイスサイズは正の整数である必要があります')
      }

      if (diceCount > 100) {
        throw new Error('ダイス数は100個以下にしてください')
      }

      for (let i = 0; i < diceCount; i++) {
        const roll = Math.floor(Math.random() * diceSize) + 1
        rolls.push(roll)
        total += roll
      }

      modifier += mod
    }

    return {
      notation,
      rolls,
      total: total + modifier,
      modifier
    }
  }

  /**
   * ダイスロールを実行
   */
  rollDice(notation: string): number {
    const result = this.parseDiceNotation(notation)
    return result.total
  }
}

// シングルトンインスタンス
export const formulaParser = new FormulaParser()
export const diceParser = new DiceParser()