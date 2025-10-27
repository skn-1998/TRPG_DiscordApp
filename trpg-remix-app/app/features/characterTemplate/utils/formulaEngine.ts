// 式エンジン: プレースホルダ{fieldId} + 演算子 + 関数

import type { EvaluationContext } from '../types'

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
  // 基本的なチェック
  if (!formula.trim()) return { valid: false, error: '式が空です' }

  // 未閉じの括弧チェック
  const openCount = (formula.match(/\(/g) || []).length
  const closeCount = (formula.match(/\)/g) || []).length
  if (openCount !== closeCount) {
    return { valid: false, error: '括弧が閉じられていません' }
  }

  // 未閉じの{}チェック
  const openBraceCount = (formula.match(/\{/g) || []).length
  const closeBraceCount = (formula.match(/\}/g) || []).length
  if (openBraceCount !== closeBraceCount) {
    return { valid: false, error: 'プレースホルダが閉じられていません' }
  }

  return { valid: true }
}

// ========================================
// 式評価器
// ========================================

/**
 * 式を評価（ホワイトリスト方式、eval禁止）
 */
export function evaluateFormula(formula: string, context: EvaluationContext): number | string | undefined {
  console.log(`🔍 evaluateFormula開始: "${formula}"`)

  try {
    // プレースホルダを値で置換
    let expr = formula
    const deps = extractDependencies(formula)
    console.log(`  📋 依存関係: [${deps.join(', ')}]`)

    for (const dep of deps) {
      const value = context[dep]
      console.log(`  🔗 {${dep}} = ${value} (${typeof value})`)

      if (value === undefined) {
        console.error(`  ❌ 未定義のフィールド参照: {${dep}}`)
        throw new Error(`未定義のフィールド参照: {${dep}}`)
      }
      // 数値または文字列リテラルに置換
      const replacement = typeof value === 'number' ? value.toString() : `"${value}"`
      expr = expr.replace(new RegExp(`\\{${dep}\\}`, 'g'), replacement)
      console.log(`  🔄 置換後: "${expr}"`)
    }

    console.log(`  📝 プレースホルダ置換完了: "${expr}"`)

    // 関数を安全に置換
    const originalExpr = expr
    expr = expr.replace(/max\(/g, 'Math.max(')
    expr = expr.replace(/min\(/g, 'Math.min(')
    expr = expr.replace(/floor\(/g, 'Math.floor(')
    expr = expr.replace(/ceil\(/g, 'Math.ceil(')
    expr = expr.replace(/round\(/g, 'Math.round(')

    if (originalExpr !== expr) {
      console.log(`  🔧 関数置換: "${originalExpr}" → "${expr}"`)
    }

    console.log(`  🎯 評価対象式: "${expr}"`)

    // evalを使わない安全な評価（Functionコンストラクタ + ホワイトリスト）
    // MVP: 数値演算のみサポート
    const safeEval = new Function('Math', `"use strict"; return (${expr})`)
    const result = safeEval(Math)

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
        const depValues: Record<string, any> = {}
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
