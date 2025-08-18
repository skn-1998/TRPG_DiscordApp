/**
 * ダイスロール結果
 */
export interface DiceResult {
  /**
   * 合計値
   */
  total: number

  /**
   * 各ダイスの出目（オプション）
   */
  rolls?: number[]

  /**
   * ダイスの種類（例: 2d6）
   */
  diceType: string

  /**
   * 詳細情報（オプション）
   */
  details?: any

  /**
   * ロール理由（オプション）
   */
  reason?: string
}

/**
 * ダイスをロールする
 * @param diceCount ダイスの数
 * @param diceFaces ダイスの面数
 * @returns ダイスロール結果
 */
export function rollDice(diceCount: number, diceFaces: number): DiceResult {
  const rolls: number[] = []
  let total = 0

  for (let i = 0; i < diceCount; i++) {
    const roll = Math.floor(Math.random() * diceFaces) + 1
    rolls.push(roll)
    total += roll
  }

  return {
    total,
    rolls,
    diceType: `${diceCount}d${diceFaces}`
  }
}

/**
 * ダイス表記を解析する
 * @param diceNotation ダイス表記（例: 2d6）
 * @returns [ダイスの数, ダイスの面数] または null（無効な表記の場合）
 */
export function parseDiceNotation(diceNotation: string): [number, number] | null {
  const match = diceNotation.toLowerCase().match(/^(\d+)d(\d+)$/)

  if (!match) {
    return null
  }

  const diceCount = parseInt(match[1], 10)
  const diceFaces = parseInt(match[2], 10)

  if (diceCount <= 0 || diceFaces <= 0) {
    return null
  }

  return [diceCount, diceFaces]
}
