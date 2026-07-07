import { Injectable, Logger } from '@nestjs/common'
import dice from './bcdice.util'

/**
 * BCDice 実行コアサービス
 *
 * 責務：
 * - ダイス式のクリーンアップ（正規化・危険文字除去・妥当性検証）
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

      // ダイスロールを実行
      const result = await dice(cleanExpression, gameSystemId)

      if (!result || !result.text) {
        throw new Error(`Invalid dice roll result for: ${cleanExpression}`)
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

      return {
        total,
        details: result.text || `${cleanExpression} = ${total}`
      }
    } catch (error) {
      this.logger.error(`Failed to execute dice roll: ${diceExpression}`, error)
      throw new Error(`ダイスロールの実行に失敗しました: ${diceExpression}`)
    }
  }

  /**
   * ダイス式をクリーンアップ
   *
   * 無効な式は throw する（validateDiceExpression 系の呼び出し元は catch して解析失敗にする）。
   */
  cleanDiceExpression(expression: string): string {
    // 基本的なクリーンアップ
    let cleaned = expression.toLowerCase().trim()

    // 危険な文字を除去
    cleaned = cleaned.replace(/[^0-9d+\-*/() ]/gi, '')

    // 空白を除去
    cleaned = cleaned.replace(/\s+/g, '')

    // 基本的な検証
    if (!cleaned.match(/^\d*d\d+([+\-*/]\d+)*$/)) {
      // 複雑な式の場合の追加検証
      if (!cleaned.match(/^[\d+\-*/()d]+$/)) {
        throw new Error(`無効なダイス式: ${expression}`)
      }
    }

    return cleaned
  }
}
