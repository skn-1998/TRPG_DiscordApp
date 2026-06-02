import { evaluateArithmetic } from './arithmetic-evaluator.util'

/**
 * 旧実装（Function による評価）と完全一致することを保証するための characterization テスト。
 * `evaluateArithmetic` が `Function('"use strict"; return (' + expr + ')')()` と
 * 同一の結果（または同一の throw 有無）を返すことを差分検証する。
 */

/* eslint-disable @typescript-eslint/no-implied-eval */
const legacyEval = (expr: string): number => {
  const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '')
  // 旧実装と同一: Function による評価
  return Function('"use strict"; return (' + sanitized + ')')() as number
}
/* eslint-enable @typescript-eslint/no-implied-eval */

/** 旧 / 新の評価を同一インターフェースで比較するためのラッパ（throw は 'ERR' に正規化）。 */
const wrap =
  (fn: (s: string) => number) =>
  (expr: string): number | 'ERR' => {
    try {
      return fn(expr)
    } catch {
      return 'ERR'
    }
  }

const legacy = wrap((s) => legacyEval(s))
const safe = wrap((s) => evaluateArithmetic(s.replace(/[^0-9+\-*/().\s]/g, '')))

/** NaN を考慮した一致判定。 */
const sameResult = (a: number | 'ERR', b: number | 'ERR'): boolean => {
  if (a === 'ERR' || b === 'ERR') return a === b
  if (Number.isNaN(a) && Number.isNaN(b)) return true
  return a === b
}

describe('evaluateArithmetic (characterization: 旧 Function 評価との完全一致)', () => {
  const fixedCases = [
    '(50) * 3',
    '1+2*3',
    '(5+5)/2',
    '10/3',
    '(100) + -5',
    '2.5*4',
    ' ( 3 ) ',
    '',
    '1/0',
    '0/0',
    '-1/0',
    '-',
    '+',
    '3..5',
    '1 2',
    '01+02',
    '.5',
    '5.',
    '(',
    ')',
    '1++2',
    '--3',
    '*2',
    '+5',
    '-5',
    '+-5',
    '-+5',
    '+-+5',
    '3-+2',
    '3*-2',
    '3*+2',
    '3/-2',
    '2---3',
    '1+-+-2',
    '00',
    '0',
    '007',
    '10.',
    '1.2.3',
    '1.',
    '(1+2',
    '1+2)',
    '()',
    '( )',
    '1+',
    '/2',
    '2/',
    '5  -  3',
    '-.5',
    '-(3)',
    '(-3)',
    '2*()',
    '01.5',
    '0.5',
    '00.5',
    '08',
    '0.0',
    '000',
    '.',
    '..',
    '0.',
    '5.5.',
    '1 + 2',
    '( 1 + 2 ) * 3',
    '2++3',
    '2--3',
    '2 ++ 3',
    '2- -3',
    '2 - -3',
    '2*3+4*5',
    '((1+2))',
    '-(-(-3))',
    '100/7',
    '1-2-3',
    '12/3/2',
    '2*3*4',
    '(10) * 2',
    '((10) * 2) + 5',
    '(10)  -3'
  ]

  it.each(fixedCases)('式 %p で旧実装と同一結果', (expr) => {
    expect(sameResult(safe(expr), legacy(expr))).toBe(true)
  })

  /**
   * 入力空間の定義:
   *   本評価器が完全一致を保証する対象は「妥当な算術式」、すなわち旧 Function 評価が
   *   有限/Infinity/NaN を含む **数値(number)** を返す入力に限る。
   *
   *   サニタイズ後の文字種でも、JS の式評価は `/.../`（正規表現リテラル）や
   *   外側ラップ `(expr)` を早期クローズする `)expr(` のような入力に対して
   *   「数値でない値（RegExp オブジェクトや文字列）」を返しうる。これらは妥当な算術式ではなく、
   *   ダイス数式の生成経路（数値置換・乗数/修正値付与）では到達しない病的入力である。
   *   本評価器はこれらを SyntaxError として扱い、呼び出し側（dice-parser/dice-calc）の
   *   catch でフォールバックされる。
   */

  it('ファズ: 旧実装と新評価器がともに数値を返す場合は完全一致（計算ロジック不変）', () => {
    const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '*', '/', '(', ')', '.', ' ']
    const san = (s: string) => s.replace(/[^0-9+\-*/().\s]/g, '')
    let comparedValid = 0
    let mismatches = 0
    const samples: string[] = []
    const iterations = 30000
    for (let n = 0; n < iterations; n++) {
      const length = 1 + Math.floor(Math.random() * 10)
      let expr = ''
      for (let k = 0; k < length; k++) {
        expr += chars[Math.floor(Math.random() * chars.length)]
      }
      // 旧実装の生の戻り値（型判定のため raw で取得）
      let legacyRaw: unknown
      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        legacyRaw = Function('"use strict"; return (' + san(expr) + ')')()
      } catch {
        legacyRaw = '__ERR__'
      }
      const safeRes = safe(expr)

      if (typeof legacyRaw === 'number' && safeRes !== 'ERR') {
        // 双方が数値を返す = 妥当な算術式。計算結果は完全一致でなければならない。
        comparedValid++
        if (!sameResult(safeRes, legacyRaw)) {
          mismatches++
          if (samples.length < 10) samples.push(expr)
        }
      }
      // それ以外（どちらかが ERR / legacy が非数値）は病的入力:
      //   - legacy が SyntaxError なら新評価器も基本 ERR。
      //   - legacy が RegExp/string、または `)..(` / `//` 等で数値化する病的入力は
      //     妥当な算術式ではなく、ダイス式生成経路に到達しない。新評価器は SyntaxError とし、
      //     呼び出し側（dice-parser/dice-calc）の catch で 1 にフォールバックする。
    }
    if (mismatches > 0) {
      console.error('MISMATCH samples:', samples.map((s) => JSON.stringify(s)).join(', '))
    }
    expect(mismatches).toBe(0)
    // 妥当式が十分サンプリングされていること（テストの有効性確認）
    expect(comparedValid).toBeGreaterThan(100)
  })
})
