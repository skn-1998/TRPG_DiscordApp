/**
 * 安全な算術式評価器（Function/eval を一切使わない純粋関数）
 *
 * 目的:
 *   ダイス数式のサニタイズ済み算術式（数値・四則・括弧・単項符号・空白のみ）を、
 *   従来の `Function('"use strict"; return (' + expr + ')')()` と完全に同一の結果で評価する。
 *
 * 設計方針（挙動完全保存）:
 *   - 入力空間は文字種 [0-9 + - * / ( ) . 空白] に限定される前提（呼び出し側でサニタイズ済み）。
 *     ただし本関数は文字種を仮定せず、許可外の構文に対しては従来の Function 評価と同様に
 *     SyntaxError 相当として {@link ArithmeticSyntaxError} を throw する。
 *   - JS の式評価サブセットを再帰下降で厳密に再現する:
 *       * 数値リテラル: JS の DecimalLiteral 規則に従う。
 *         - `0` 単独は可。先頭ゼロ + 追加数字（`00`, `007`, `08`, `01.5`）は strict mode 同様 SyntaxError。
 *         - `.5` / `5.` / `10.` / `0.0` は可。`1.2.3` / `.` / `..` は SyntaxError。
 *         - 指数表記(e)はサニタイズ後の入力に出現しないため非対応（出現時は SyntaxError）。
 *       * 単項 +/- は連鎖可能（`+-5`, `1+-+-2`）。
 *         ただし空白を挟まない `++` / `--` は JS のインクリメント/デクリメント演算子として扱われ、
 *         数値リテラルに適用できないため SyntaxError（`2--3`, `--2`）。空白ありの `2- -3` は可。
 *       * 二項演算子の優先順位（低→高）: `+ -`（左結合）< `* /`（左結合）< `**`（右結合・最高）。
 *         べき乗 `**` は JS 同様、左オペランドに単項 +/- を直接取れない（`-2**2` は SyntaxError）が、
 *         右オペランドには単項を取れる（`2**-1` は可）。
 *       * 括弧でグループ化。空括弧 `()` は SyntaxError。
 *
 * 非対応（病的入力）:
 *   - JS の式評価では `/.../`（正規表現リテラル）や、外側ラップ `(expr)` を `)expr(` のように
 *     早期クローズする入力が「式以外」として評価されうるが、これらは妥当な算術式ではないため
 *     本関数では SyntaxError として throw する（呼び出し側の catch でフォールバックされる）。
 *     ダイス数式の生成経路（数値置換・乗数/修正値付与）では到達しない。
 *   - 0除算は JS と同じく Infinity / -Infinity / NaN を返す（throw しない）。
 *
 * 戻り値:
 *   評価結果の数値。範囲チェック・丸め・catch によるフォールバックは行わない（呼び出し側の責務）。
 */

/** 算術式の構文エラー（従来の Function 評価における SyntaxError 相当）。 */
export class ArithmeticSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArithmeticSyntaxError'
  }
}

type TokenType = 'number' | 'plus' | 'minus' | 'star' | 'starstar' | 'slash' | 'lparen' | 'rparen' | 'incdec'

interface Token {
  type: TokenType
  value: string
}

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9'
const isWhitespace = (ch: string): boolean =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\v' || ch === '\f'

/**
 * 字句解析。
 * `++` / `--`（空白を挟まない2連続の同符号）は 1 トークン `incdec` として切り出す。
 * これにより JS のインクリメント/デクリメント演算子と同等に扱い、構文エラーを再現する。
 */
function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const len = expr.length

  while (i < len) {
    const ch = expr[i]

    if (isWhitespace(ch)) {
      i++
      continue
    }

    if (ch === '+' || ch === '-') {
      // 空白を挟まない2連続同符号は ++ / -- 演算子
      if (expr[i + 1] === ch) {
        tokens.push({ type: 'incdec', value: ch + ch })
        i += 2
        continue
      }
      tokens.push({ type: ch === '+' ? 'plus' : 'minus', value: ch })
      i++
      continue
    }

    if (ch === '*') {
      // 空白を挟まない `**` はべき乗演算子
      if (expr[i + 1] === '*') {
        tokens.push({ type: 'starstar', value: '**' })
        i += 2
        continue
      }
      tokens.push({ type: 'star', value: ch })
      i++
      continue
    }
    if (ch === '/') {
      tokens.push({ type: 'slash', value: ch })
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch })
      i++
      continue
    }

    if (isDigit(ch) || ch === '.') {
      const start = i
      // 整数部
      while (i < len && isDigit(expr[i])) {
        i++
      }
      // 小数部
      let hasDot = false
      if (i < len && expr[i] === '.') {
        hasDot = true
        i++
        while (i < len && isDigit(expr[i])) {
          i++
        }
      }
      const raw = expr.slice(start, i)
      validateNumberLiteral(raw, hasDot)
      tokens.push({ type: 'number', value: raw })
      continue
    }

    // 許可外文字（サニタイズ後は来ない想定だが防御的に）
    throw new ArithmeticSyntaxError(`Unexpected character: ${JSON.stringify(ch)}`)
  }

  return tokens
}

/**
 * 数値リテラルの妥当性検証（JS strict mode の DecimalLiteral 相当）。
 * - `.` 単独や `..` は不可（少なくとも 1 桁の数字が必要）。
 * - 先頭ゼロ + 追加数字（`00`, `007`, `08`, `01.5`）は不可（旧8進リテラル扱いで SyntaxError）。
 */
function validateNumberLiteral(raw: string, hasDot: boolean): void {
  // 少なくとも 1 桁の数字を含むこと（'.' のみは不可）
  if (!/[0-9]/.test(raw)) {
    throw new ArithmeticSyntaxError(`Invalid number literal: ${JSON.stringify(raw)}`)
  }

  const intPart = hasDot ? raw.slice(0, raw.indexOf('.')) : raw

  // 整数部が先頭ゼロを持ち、かつ複数桁の場合は SyntaxError（00, 007, 08, 01.5 ...）
  // ただし整数部が空（.5 等）や "0" 単独は許可。
  if (intPart.length > 1 && intPart[0] === '0') {
    throw new ArithmeticSyntaxError(`Invalid number literal (leading zero): ${JSON.stringify(raw)}`)
  }
}

/** 再帰下降パーサ本体。 */
class Parser {
  private pos = 0

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    if (this.tokens.length === 0) {
      // 空式（''）は Function('return ()') 同様 SyntaxError
      throw new ArithmeticSyntaxError('Empty expression')
    }
    const value = this.parseAddSub()
    if (this.pos < this.tokens.length) {
      throw new ArithmeticSyntaxError(`Unexpected token: ${this.tokens[this.pos].value}`)
    }
    return value
  }

  /** 加減算（左結合・低優先）。 */
  private parseAddSub(): number {
    let left = this.parseMulDiv()
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos]
      if (t.type === 'plus') {
        this.pos++
        left = left + this.parseMulDiv()
      } else if (t.type === 'minus') {
        this.pos++
        left = left - this.parseMulDiv()
      } else {
        break
      }
    }
    return left
  }

  /** 乗除算（左結合）。項は単項式。 */
  private parseMulDiv(): number {
    let left = this.parseUnary()
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos]
      if (t.type === 'star') {
        this.pos++
        left = left * this.parseUnary()
      } else if (t.type === 'slash') {
        this.pos++
        left = left / this.parseUnary()
      } else {
        break
      }
    }
    return left
  }

  /**
   * 単項式（乗除算の項）。
   *
   * 先頭が符号でない場合のみ、続く `**`（べき乗）を消費しうる（{@link parsePower}）。
   * 先頭が単項符号 +/- の場合は {@link parseSignedOperand} に委譲し、被演算子に `**` を
   * 含めないという JS の早期エラー規則（`-2**2`, `+7**93` は SyntaxError）を再現する。
   */
  private parseUnary(): number {
    const t = this.tokens[this.pos]
    if (t === undefined) {
      throw new ArithmeticSyntaxError('Unexpected end of expression')
    }
    if (t.type === 'plus' || t.type === 'minus') {
      return this.parseSignedOperand()
    }
    // incdec(++/--) が単項位置に来た場合は SyntaxError（数値リテラルへの適用不可）
    if (t.type === 'incdec') {
      throw new ArithmeticSyntaxError(`Invalid operator: ${t.value}`)
    }
    return this.parsePower()
  }

  /**
   * 単項符号付きオペランド。
   * 符号 +/- を（連鎖可能に）消費し、被演算子は「`**` を含まない一次式」とする。
   * 被演算子の直後に `**` が来た場合は JS 同様 SyntaxError。
   * 例: `+5**54` は `+` の被演算子に `5**54` を取れないため SyntaxError。
   */
  private parseSignedOperand(): number {
    const t = this.tokens[this.pos]
    if (t === undefined) {
      throw new ArithmeticSyntaxError('Unexpected end of expression')
    }
    if (t.type === 'plus' || t.type === 'minus') {
      const sign = t.type === 'plus' ? 1 : -1
      this.pos++
      const operand = this.parseSignedOperand()
      return sign * operand
    }
    if (t.type === 'incdec') {
      throw new ArithmeticSyntaxError(`Invalid operator: ${t.value}`)
    }
    const value = this.parsePrimary()
    // 符号付きオペランドの被演算子に `**` を続けることは禁止
    if (this.tokens[this.pos]?.type === 'starstar') {
      throw new ArithmeticSyntaxError('Unary operator cannot be the left operand of **')
    }
    return value
  }

  /**
   * べき乗 `**`（右結合・最高優先）。
   * 左オペランドは単項符号を含まない一次式、右オペランドは単項式（符号可）。
   */
  private parsePower(): number {
    const base = this.parsePrimary()
    const t = this.tokens[this.pos]
    if (t !== undefined && t.type === 'starstar') {
      this.pos++
      const exponent = this.parseUnary()
      return Math.pow(base, exponent)
    }
    return base
  }

  /** 一次（数値リテラル / 括弧）。 */
  private parsePrimary(): number {
    const t = this.tokens[this.pos]
    if (t === undefined) {
      throw new ArithmeticSyntaxError('Unexpected end of expression')
    }
    if (t.type === 'number') {
      this.pos++
      return Number(t.value)
    }
    if (t.type === 'lparen') {
      this.pos++
      // 空括弧 () は SyntaxError
      if (this.tokens[this.pos]?.type === 'rparen') {
        throw new ArithmeticSyntaxError('Empty parentheses')
      }
      const value = this.parseAddSub()
      const close = this.tokens[this.pos]
      if (close === undefined || close.type !== 'rparen') {
        throw new ArithmeticSyntaxError('Missing closing parenthesis')
      }
      this.pos++
      return value
    }
    throw new ArithmeticSyntaxError(`Unexpected token: ${t.value}`)
  }
}

/**
 * 安全な算術式評価。
 *
 * 従来の `Function('"use strict"; return (' + expr + ')')()` と同一の結果を返す。
 * 構文として不正な場合は {@link ArithmeticSyntaxError} を throw する（呼び出し側で catch する想定）。
 * 0除算などは JS と同じく Infinity / NaN を返す。
 *
 * @param expr 評価対象の算術式（呼び出し側でサニタイズ済みであることを想定）
 * @returns 評価結果の数値
 */
export function evaluateArithmetic(expr: string): number {
  const tokens = tokenize(expr)
  return new Parser(tokens).parse()
}
