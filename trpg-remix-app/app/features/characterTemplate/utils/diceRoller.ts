// ダイスロール評価器: [NdM], [NdM+K], [NdM-K]

export interface DiceRollResult {
  formula: string // 元の式
  rolls: number[] // 各ダイスの出目
  modifier: number // 修正値
  total: number // 合計
}

// ========================================
// ダイス式パーサー
// ========================================

/**
 * ダイス式の構文チェック
 */
export function validateDiceFormula(formula: string): { valid: boolean; error?: string } {
  const trimmed = formula.trim()
  if (!trimmed) return { valid: false, error: 'ダイス式が空です' }

  // [NdM], [NdM+K], [NdM-K] のパターン
  const pattern = /^\[(\d+)d(\d+)([+-]\d+)?\]$/i
  if (!pattern.test(trimmed)) {
    return { valid: false, error: 'ダイス式の形式が正しくありません（例: [3d6], [1d100], [2d6+6]）' }
  }

  const match = trimmed.match(pattern)
  if (!match) return { valid: false, error: 'ダイス式のパースに失敗しました' }

  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)

  if (count < 1 || count > 100) {
    return { valid: false, error: 'ダイスの個数は1～100の範囲で指定してください' }
  }

  if (sides < 2 || sides > 10000) {
    return { valid: false, error: 'ダイスの面数は2～10000の範囲で指定してください' }
  }

  return { valid: true }
}

/**
 * ダイス式をパース
 */
export function parseDiceFormula(formula: string): { count: number; sides: number; modifier: number } | null {
  const trimmed = formula.trim()
  const pattern = /^\[(\d+)d(\d+)([+-]\d+)?\]$/i
  const match = trimmed.match(pattern)

  if (!match) return null

  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  const modifier = match[3] ? parseInt(match[3], 10) : 0

  return { count, sides, modifier }
}

// ========================================
// ダイスロール実行
// ========================================

/**
 * ダイスを振る
 */
export function rollDice(formula: string): DiceRollResult | null {
  const parsed = parseDiceFormula(formula)
  if (!parsed) return null

  const { count, sides, modifier } = parsed
  const rolls: number[] = []

  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1
    rolls.push(roll)
  }

  const sum = rolls.reduce((acc, r) => acc + r, 0)
  const total = sum + modifier

  return {
    formula,
    rolls,
    modifier,
    total
  }
}

/**
 * 複数のダイスをまとめて振る
 */
export function rollMultipleDice(formulas: string[]): Map<string, DiceRollResult> {
  const results = new Map<string, DiceRollResult>()

  for (const formula of formulas) {
    const result = rollDice(formula)
    if (result) {
      results.set(formula, result)
    }
  }

  return results
}
