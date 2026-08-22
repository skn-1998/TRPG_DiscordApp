import { Injectable, Logger } from '@nestjs/common'
import dice from './bcdice.util'

type DiceComparison = {
  operator: '<=' | '>='
  target: number
}

type ParsedDiceExpression = {
  rollExpression: string
  comparison?: DiceComparison
}

export class UnsupportedDiceNotationError extends Error {
  override readonly name = 'UnsupportedDiceNotationError'
}

const SUPPORTED_ROLL_NOTATION_PATTERN = /^[\d+\-*/()d]+$/
const PLAIN_COMPARISON_TARGET_PATTERN = /^-?\d+(?:\.\d+)?$/
// 右辺から比較記号を除外しておくことで、lazy な左辺は最後の <= / >= までをロール式として保持する。
const TRAILING_COMPARISON_PATTERN = /^(.+?)(<=|>=)([\d.+\-*/()]+)$/

/**
 * 比較右辺だけを評価する再帰下降パーサ。
 *
 * 文法境界: expr = term ((+|-) term)* / term = factor ((*|/) factor)* /
 * factor = '-'? (number | '(' expr ')') / number = \d+(\.\d+)?。
 * ダイス記法はロール側の既存 whitelist と BCDice に委ね、ここへ混在させない。
 */
class ComparisonTargetParser {
  private position = 0

  constructor(
    private readonly targetExpression: string,
    private readonly sourceExpression: string
  ) {}

  parse(): number {
    const value = this.parseExpression()
    if (this.position !== this.targetExpression.length) {
      this.throwUnsupportedNotation()
    }

    return this.assertSupportedValue(value)
  }

  private parseExpression(): number {
    let value = this.parseTerm()

    while (this.currentToken() === '+' || this.currentToken() === '-') {
      const operator = this.consumeToken()
      const right = this.parseTerm()
      value = this.assertSupportedValue(operator === '+' ? value + right : value - right)
    }

    return value
  }

  private parseTerm(): number {
    let value = this.parseFactor()

    while (this.currentToken() === '*' || this.currentToken() === '/') {
      const operator = this.consumeToken()
      const right = this.parseFactor()
      if (operator === '/' && right === 0) {
        this.throwUnsupportedNotation()
      }
      value = this.assertSupportedValue(operator === '*' ? value * right : value / right)
    }

    return value
  }

  private parseFactor(): number {
    let sign = 1
    if (this.currentToken() === '-') {
      this.consumeToken()
      sign = -1
    }

    if (this.currentToken() === '(') {
      this.consumeToken()
      const value = this.parseExpression()
      if (this.currentToken() !== ')') {
        this.throwUnsupportedNotation()
      }
      this.consumeToken()
      return this.assertSupportedValue(sign * value)
    }

    return this.assertSupportedValue(sign * this.parseNumber())
  }

  private parseNumber(): number {
    const numberMatch = this.targetExpression.slice(this.position).match(/^\d+(?:\.\d+)?/)
    if (!numberMatch) {
      this.throwUnsupportedNotation()
    }

    this.position += numberMatch[0].length
    return this.assertSupportedValue(Number(numberMatch[0]))
  }

  private currentToken(): string | undefined {
    return this.targetExpression[this.position]
  }

  private consumeToken(): string {
    const token = this.targetExpression[this.position]
    if (!token) {
      this.throwUnsupportedNotation()
    }
    this.position += 1
    return token
  }

  private assertSupportedValue(value: number): number {
    // 安全域を一度でも外れた Number は後続演算で範囲内へ戻っても精度を復元できないため、中間値ごと拒否する。
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      this.throwUnsupportedNotation()
    }
    return value
  }

  private throwUnsupportedNotation(): never {
    throw new UnsupportedDiceNotationError(`未対応のダイス記法です: ${this.sourceExpression}`)
  }
}

const evaluateComparisonTarget = (targetExpression: string, sourceExpression: string): number =>
  new ComparisonTargetParser(targetExpression, sourceExpression).parse()

/**
 * BCDice 実行コアサービス
 *
 * 責務：
 * - ダイス式の正規化・未対応記法の拒否・末尾比較の分離
 * - BCDice ローダ経由でのダイス式評価（bcdice.util）
 * - BCDice 結果からの total / details 抽出
 *
 * discord.js 非依存の実行コア（E-6e で discord/services/dice/dice-roll-logic.service.ts の
 * executeDiceRoll / cleanDiceExpression をロジック行対行で移設）。
 * Discord 以外の呼び出し元（将来の REST ダイス API 等）からも利用できる。
 * 履歴の保存はしない（保存は DiceRollService の責務）。
 */
@Injectable()
export class DiceExecutionService {
  private readonly logger = new Logger(DiceExecutionService.name)

  /**
   * ダイスロールを実行（式クリーニング → BCDice eval → 結果抽出）
   *
   * @param gameSystemId 省略時は bcdice.util 側の既定（DiceBot）でロードする
   */
  async executeDiceRoll(diceExpression: string, gameSystemId?: string): Promise<{ total: number; details: string }> {
    try {
      // ダイス式をクリーンアップ
      const cleanExpression = this.cleanDiceExpression(diceExpression)
      const { rollExpression, comparison } = this.parseCleanExpression(cleanExpression)

      // ダイスロールを実行
      const result = await dice(rollExpression, gameSystemId)

      if (!result || !result.text) {
        throw new Error(`Invalid dice roll result for: ${rollExpression}`)
      }

      // BCDiceの結果からtotalを取得
      // 方法1: randsから合計を計算（最も正確）
      let total = 0
      if (result.rands && Array.isArray(result.rands)) {
        total = result.rands.reduce((acc: number, curr: number[]) => acc + (curr[0] || 0), 0)
      }

      // 方法2: randsがない場合はtextから抽出
      // BCDiceの形式: "(1D100) ＞ 73" または "(2D6) ＞ 7[3,4]"
      if (total === 0 && result.text) {
        // "＞" または ">" の後の数字を取得
        const match = result.text.match(/[＞>]\s*(\d+)/)
        if (match && match[1]) {
          total = parseInt(match[1], 10)
        }
      }

      this.logger.debug(`Dice roll result: ${cleanExpression} = ${total} (${result.text})`)

      const comparisonValue = comparison ? this.extractEvaluatedTotal(result) : total
      return {
        total,
        details: this.appendComparisonResult(result.text, comparisonValue, comparison)
      }
    } catch (error) {
      if (error instanceof UnsupportedDiceNotationError) {
        this.logger.warn(`Unsupported dice notation: ${diceExpression}`)
        throw error
      }
      this.logger.error(`Failed to execute dice roll: ${diceExpression}`, error)
      throw new Error(`ダイスロールの実行に失敗しました: ${diceExpression}`)
    }
  }

  /**
   * ダイス式全体の評価済み最終値を返す。
   *
   * executeDiceRoll は legacy 互換の rands 合算 total を維持するため、
   * 作成時ロールなど式修飾子込みの値が必要な呼び出し元はこちらを使う。
   */
  async executeEvaluatedDiceRoll(
    diceExpression: string,
    gameSystemId?: string
  ): Promise<{ total: number; details: string }> {
    try {
      const cleanExpression = this.cleanDiceExpression(diceExpression)
      const { rollExpression, comparison } = this.parseCleanExpression(cleanExpression)
      const result = await dice(rollExpression, gameSystemId)

      if (!result || !result.text) {
        throw new Error(`Invalid dice roll result for: ${rollExpression}`)
      }

      const total = this.extractEvaluatedTotal(result)
      this.logger.debug(`Evaluated dice roll result: ${cleanExpression} = ${total} (${result.text})`)

      return {
        total,
        details: this.appendComparisonResult(result.text, total, comparison)
      }
    } catch (error) {
      if (error instanceof UnsupportedDiceNotationError) {
        this.logger.warn(`Unsupported dice notation: ${diceExpression}`)
        throw error
      }
      this.logger.error(`Failed to execute evaluated dice roll: ${diceExpression}`, error)
      throw new Error(`ダイスロールの実行に失敗しました: ${diceExpression}`)
    }
  }

  /**
   * ダイス式をクリーンアップ
   *
   * 未対応記法は UnsupportedDiceNotationError として入力由来のメッセージを保つ。
   * 空入力などその他の無効な式は通常の解析失敗として throw する。
   */
  cleanDiceExpression(expression: string): string {
    const normalized = expression.toLowerCase().trim().replace(/\s+/g, '')
    if (!normalized) {
      throw new Error(`無効なダイス式: ${expression}`)
    }

    const comparisonMatch = normalized.match(TRAILING_COMPARISON_PATTERN)
    const rollExpression = comparisonMatch?.[1] ?? normalized
    const hasUnsupportedNotation = !SUPPORTED_ROLL_NOTATION_PATTERN.test(rollExpression)

    if (hasUnsupportedNotation) {
      throw new UnsupportedDiceNotationError(`未対応のダイス記法です: ${expression}`)
    }

    if (comparisonMatch?.[3]) {
      const targetExpression = comparisonMatch[3]
      if (PLAIN_COMPARISON_TARGET_PATTERN.test(targetExpression)) {
        this.assertSupportedComparisonTarget(targetExpression, expression)
      } else {
        evaluateComparisonTarget(targetExpression, expression)
      }
    }

    return comparisonMatch ? `${rollExpression}${comparisonMatch[2]}${comparisonMatch[3]}` : rollExpression
  }

  private parseCleanExpression(cleanExpression: string): ParsedDiceExpression {
    const comparisonMatch = cleanExpression.match(TRAILING_COMPARISON_PATTERN)
    if (!comparisonMatch) {
      return { rollExpression: cleanExpression }
    }

    const [, rollExpression, matchedOperator, targetExpression] = comparisonMatch
    if (!rollExpression || !targetExpression) {
      throw new Error(`Invalid cleaned dice expression: ${cleanExpression}`)
    }
    const operator = matchedOperator as DiceComparison['operator']
    const target = PLAIN_COMPARISON_TARGET_PATTERN.test(targetExpression)
      ? Number(targetExpression)
      : evaluateComparisonTarget(targetExpression, cleanExpression)

    return {
      rollExpression,
      comparison: {
        operator,
        target
      }
    }
  }

  private assertSupportedComparisonTarget(targetLiteral: string, sourceExpression: string): void {
    const unsignedTargetLiteral = targetLiteral.startsWith('-') ? targetLiteral.slice(1) : targetLiteral
    const [integerPart, fractionalPart = ''] = unsignedTargetLiteral.split('.')
    const integerMagnitude = BigInt(integerPart)
    const safeIntegerBoundary = BigInt(Number.MAX_SAFE_INTEGER)
    const exceedsSafeIntegerBoundary =
      integerMagnitude > safeIntegerBoundary ||
      (integerMagnitude === safeIntegerBoundary && /[1-9]/.test(fractionalPart))

    if (exceedsSafeIntegerBoundary) {
      throw new UnsupportedDiceNotationError(`未対応のダイス記法です: ${sourceExpression}`)
    }
  }

  private appendComparisonResult(details: string, evaluatedValue: number, comparison?: DiceComparison): string {
    if (!comparison) {
      return details
    }

    const isSuccess =
      comparison.operator === '<=' ? evaluatedValue <= comparison.target : evaluatedValue >= comparison.target
    const displayOperator = comparison.operator === '<=' ? '≤' : '≥'
    return `${details} ${displayOperator} ${comparison.target} → ${isSuccess ? '成功' : '失敗'}`
  }

  private extractEvaluatedTotal(result: NonNullable<Awaited<ReturnType<typeof dice>>>): number {
    // BCDice text の最後の「＞ 数値」を評価済み総和とみなせるのは、比較記法を BCDice へ渡す前に
    // 分離して判定テキストが末尾に付かず、whitelist が AddDice / D66 系に限定されている間だけである。
    // whitelist の拡張または比較の BCDice 委譲を行うときは、この抽出方法を見直すこと。
    const matches = Array.from(result.text.matchAll(/[＞>]\s*(-?\d+(?:\.\d+)?)/g))
    const lastMatch = matches[matches.length - 1]
    if (lastMatch?.[1]) {
      return Number(lastMatch[1])
    }

    throw new Error(`Could not extract evaluated total from: ${result.text}`)
  }
}
