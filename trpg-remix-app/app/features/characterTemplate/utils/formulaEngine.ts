// 式エンジン: プレースホルダ{fieldId} + 演算子 + 関数

import type { EvaluationContext } from '../types'

type FormulaToken =
  | { type: 'number'; value: string }
  | { type: 'field'; value: string }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma'; value: ',' }

type FormulaFunction = (...args: number[]) => number
type OperatorTokenValue = Extract<FormulaToken, { type: 'operator' }>['value']
type ParenTokenValue = Extract<FormulaToken, { type: 'paren' }>['value']

const ALLOWED_FUNCTIONS: Record<string, { minArgs: number; maxArgs?: number; fn: FormulaFunction }> = {
  max: { minArgs: 1, fn: (...args) => Math.max(...args) },
  min: { minArgs: 1, fn: (...args) => Math.min(...args) },
  floor: { minArgs: 1, maxArgs: 1, fn: (value) => Math.floor(value) },
  ceil: { minArgs: 1, maxArgs: 1, fn: (value) => Math.ceil(value) },
  round: { minArgs: 1, maxArgs: 1, fn: (value) => Math.round(value) }
}

// ========================================
// 式パーサー
// ========================================

/**
 * 式から{fieldId}プレースホルダを抽出
 */
export function extractDependencies(formula: string): string[] {
  const regex = /\{(\w+)\}/g
  const deps: string[] = []
  let match
  while ((match = regex.exec(formula)) !== null) {
    deps.push(match[1])
  }
  return Array.from(new Set(deps))
}

/**
 * 式の構文チェック（簡易）
 */
export function validateFormulaSyntax(formula: string): { valid: boolean; error?: string } {
  if (!formula.trim()) return { valid: false, error: '式が空です' }

  try {
    evaluateNumericFormula(formula, {}, true)
    return { valid: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : '式の構文が不正です'
    return { valid: false, error: message }
  }
}

// ========================================
// 式評価器
// ========================================

function tokenizeFormula(formula: string): FormulaToken[] {
  const tokens: FormulaToken[] = []
  let index = 0

  while (index < formula.length) {
    const char = formula[index]

    if (/\s/.test(char)) {
      index++
      continue
    }

    if (/[0-9.]/.test(char)) {
      const start = index
      let dotCount = 0

      while (index < formula.length && /[0-9.]/.test(formula[index])) {
        if (formula[index] === '.') dotCount++
        index++
      }

      const value = formula.slice(start, index)
      if (dotCount > 1 || value === '.') {
        throw new Error(`数値リテラルが不正です: ${value}`)
      }

      tokens.push({ type: 'number', value })
      continue
    }

    if (char === '{') {
      const end = formula.indexOf('}', index + 1)
      if (end === -1) {
        throw new Error('プレースホルダが閉じられていません')
      }

      const fieldId = formula.slice(index + 1, end)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldId)) {
        throw new Error(`フィールドIDが不正です: {${fieldId}}`)
      }

      tokens.push({ type: 'field', value: fieldId })
      index = end + 1
      continue
    }

    if (/[a-zA-Z_]/.test(char)) {
      const start = index
      while (index < formula.length && /[a-zA-Z0-9_]/.test(formula[index])) {
        index++
      }
      tokens.push({ type: 'identifier', value: formula.slice(start, index) })
      continue
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'operator', value: char })
      index++
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char })
      index++
      continue
    }

    if (char === ',') {
      tokens.push({ type: 'comma', value: char })
      index++
      continue
    }

    throw new Error(`使用できない文字です: ${char}`)
  }

  return tokens
}

function toNumericValue(value: EvaluationContext[string], fieldId: string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`フィールド {${fieldId}} の値が有限数ではありません`)
    }
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  throw new Error(`フィールド {${fieldId}} は数値として評価できません`)
}

class FormulaParser {
  private position = 0

  constructor(
    private readonly tokens: FormulaToken[],
    private readonly context: EvaluationContext,
    private readonly syntaxOnly: boolean
  ) {}

  parse(): number {
    const value = this.parseExpression()
    if (!this.isAtEnd()) {
      throw new Error('式の末尾に不正なトークンがあります')
    }
    return value
  }

  private parseExpression(): number {
    let value = this.parseTerm()

    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value
      const right = this.parseTerm()
      value = operator === '+' ? value + right : value - right
    }

    return value
  }

  private parseTerm(): number {
    let value = this.parseUnary()

    while (this.matchOperator('*') || this.matchOperator('/')) {
      const operator = this.previous().value
      const right = this.parseUnary()

      if (operator === '/' && right === 0) {
        throw new Error('0で除算できません')
      }

      value = operator === '*' ? value * right : value / right
    }

    return value
  }

  private parseUnary(): number {
    if (this.matchOperator('+')) {
      return this.parseUnary()
    }

    if (this.matchOperator('-')) {
      return -this.parseUnary()
    }

    return this.parsePrimary()
  }

  private parsePrimary(): number {
    if (this.match('number')) {
      const value = Number(this.previous().value)
      if (!Number.isFinite(value)) {
        throw new Error(`数値リテラルが不正です: ${this.previous().value}`)
      }
      return value
    }

    if (this.match('field')) {
      const fieldId = this.previous().value
      if (this.syntaxOnly) {
        return 0
      }

      const value = this.context[fieldId]
      if (value === undefined) {
        throw new Error(`未定義のフィールド参照: {${fieldId}}`)
      }
      return toNumericValue(value, fieldId)
    }

    if (this.match('identifier')) {
      return this.parseFunctionCall(this.previous().value)
    }

    if (this.matchParen('(')) {
      const value = this.parseExpression()
      this.consumeParen(')', '括弧が閉じられていません')
      return value
    }

    throw new Error('式の構文が不正です')
  }

  private parseFunctionCall(name: string): number {
    const definition = ALLOWED_FUNCTIONS[name]
    if (!definition) {
      throw new Error(`使用できない関数です: ${name}`)
    }

    this.consumeParen('(', `関数 ${name} の呼び出しには括弧が必要です`)

    const args: number[] = []
    if (!this.checkParen(')')) {
      do {
        args.push(this.parseExpression())
      } while (this.match('comma'))
    }

    this.consumeParen(')', `関数 ${name} の括弧が閉じられていません`)

    if (args.length < definition.minArgs || (definition.maxArgs !== undefined && args.length > definition.maxArgs)) {
      throw new Error(`関数 ${name} の引数の数が不正です`)
    }

    return definition.fn(...args)
  }

  private match(type: FormulaToken['type']): boolean {
    if (!this.check(type)) {
      return false
    }
    this.position++
    return true
  }

  private matchOperator(value: OperatorTokenValue): boolean {
    if (!this.checkOperator(value)) {
      return false
    }
    this.position++
    return true
  }

  private matchParen(value: ParenTokenValue): boolean {
    if (!this.checkParen(value)) {
      return false
    }
    this.position++
    return true
  }

  private consumeParen(value: ParenTokenValue, message: string): void {
    if (!this.matchParen(value)) {
      throw new Error(message)
    }
  }

  private check(type: FormulaToken['type']): boolean {
    if (this.isAtEnd()) {
      return false
    }
    return this.peek().type === type
  }

  private checkOperator(value: OperatorTokenValue): boolean {
    if (this.isAtEnd()) {
      return false
    }
    const token = this.peek()
    return token.type === 'operator' && token.value === value
  }

  private checkParen(value: ParenTokenValue): boolean {
    if (this.isAtEnd()) {
      return false
    }
    const token = this.peek()
    return token.type === 'paren' && token.value === value
  }

  private isAtEnd(): boolean {
    return this.position >= this.tokens.length
  }

  private peek(): FormulaToken {
    return this.tokens[this.position]
  }

  private previous(): FormulaToken {
    return this.tokens[this.position - 1]
  }
}

function evaluateNumericFormula(formula: string, context: EvaluationContext, syntaxOnly = false): number {
  const tokens = tokenizeFormula(formula)
  const parser = new FormulaParser(tokens, context, syntaxOnly)
  return parser.parse()
}

/**
 * 式を評価（ホワイトリスト方式、eval禁止）
 */
export function evaluateFormula(formula: string, context: EvaluationContext): number | string | undefined {
  console.log(`🔍 evaluateFormula開始: "${formula}"`)

  try {
    const deps = extractDependencies(formula)
    console.log(`  📋 依存関係: [${deps.join(', ')}]`)

    for (const dep of deps) {
      const value = context[dep]
      console.log(`  🔗 {${dep}} = ${value} (${typeof value})`)
    }

    const result = evaluateNumericFormula(formula, context)

    console.log(`  ✅ 評価結果: ${result} (${typeof result})`)
    return result
  } catch (error) {
    console.error(`  ❌ Formula evaluation error:`, error)
    console.error(`  📝 失敗した式: "${formula}"`)
    console.error(`  🔍 コンテキスト:`, context)
    return undefined
  }
}

/**
 * 計算フィールドの評価（再帰的に依存を解決）
 */
export function evaluateComputedFields(
  fields: Array<{ id: string; formula?: string }>,
  context: EvaluationContext
): EvaluationContext {
  console.log('🧮 evaluateComputedFields開始:', {
    fieldsCount: fields.length,
    contextKeys: Object.keys(context),
    contextValues: context
  })

  const newContext: EvaluationContext = { ...context }

  // トポロジカルソートして依存順に評価（簡易版）
  const computed = fields.filter((f) => f.formula)
  console.log(
    '📊 計算対象フィールド:',
    computed.map((f) => ({ id: f.id, formula: f.formula }))
  )

  const maxIterations = computed.length * 2 // 無限ループ防止
  console.log('🔄 最大反復回数:', maxIterations)

  let iteration = 0
  let updated = true

  while (updated && iteration < maxIterations) {
    updated = false
    iteration++
    console.log(`\n🔄 反復 ${iteration} 開始:`)

    for (const field of computed) {
      if (!field.formula) continue

      const deps = extractDependencies(field.formula)
      const allDepsResolved = deps.every((dep) => newContext[dep] !== undefined)
      const currentValue = newContext[field.id]

      console.log(`  📝 フィールド ${field.id}:`, {
        formula: field.formula,
        dependencies: deps,
        allDepsResolved,
        currentValue,
        willEvaluate: allDepsResolved
      })

      // 依存関係が解決されている場合、常に再計算を実行
      if (allDepsResolved) {
        console.log(`    🎯 計算実行: ${field.formula}`)

        // 依存関係の値をログ出力
        const depValues: Record<string, EvaluationContext[string]> = {}
        for (const dep of deps) {
          depValues[dep] = newContext[dep]
        }
        console.log(`    📊 依存関係の値:`, depValues)

        const value = evaluateFormula(field.formula, newContext)
        console.log(`    ✅ 計算結果: ${value}`)

        if (value !== undefined) {
          // 値が変更された場合のみ更新フラグを立てる
          if (newContext[field.id] !== value) {
            newContext[field.id] = value
            updated = true
            console.log(`    ✨ 値更新: ${field.id} = ${value} (前の値: ${currentValue})`)
          } else {
            console.log(`    ✅ 値変更なし: ${field.id} = ${value}`)
          }
        } else {
          console.log(`    ❌ 計算失敗: ${field.id}`)
        }
      } else {
        const unresolvedDeps = deps.filter((dep) => newContext[dep] === undefined)
        console.log(`    ⏳ 依存関係未解決: ${unresolvedDeps.join(', ')}`)
      }
    }

    console.log(`🔄 反復 ${iteration} 完了: updated=${updated}`)
  }

  if (iteration >= maxIterations) {
    console.warn('⚠️ 最大反復回数に達しました。循環参照の可能性があります。')
  }

  console.log('🧮 evaluateComputedFields完了:', {
    iterations: iteration,
    finalContext: newContext,
    changes: Object.keys(newContext).filter((key) => context[key] !== newContext[key])
  })

  return newContext
}
