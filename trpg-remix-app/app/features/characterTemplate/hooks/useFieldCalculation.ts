import { useCallback, useMemo } from 'react'
import type { Field, EvaluationContext } from '../types'
import { evaluateComputedFields } from '../utils/formulaEngine'
import { buildDependencyGraph, getAllDependents } from '../utils/dependencyGraph'

export const useFieldCalculation = () => {
  /**
   * 全計算フィールドを評価
   */
  const evaluateAll = useCallback((fields: Field[], context: EvaluationContext): EvaluationContext => {
    return evaluateComputedFields(fields, context)
  }, [])

  /**
   * 特定フィールドの変更に伴う再計算（改善版）
   */
  const recalculate = useCallback(
    (
      fieldId: string,
      newValue: number | string | boolean | undefined,
      fields: Field[],
      context: EvaluationContext
    ): EvaluationContext => {
      console.log('🔄 フィールド再計算開始:', { fieldId, newValue, context })

      // 新しいコンテキストを作成
      const newContext: EvaluationContext = { ...context, [fieldId]: newValue }

      // 依存グラフを構築
      const graph = buildDependencyGraph(fields)

      // このフィールドに依存している全フィールドを取得
      const dependents = getAllDependents(fieldId, graph)
      console.log('📊 依存関係:', { fieldId, dependents: Array.from(dependents) })

      // 依存先の計算フィールドを再評価
      const computedFields = fields.filter((f) => f.type === 'computed' && dependents.has(f.id))
      console.log(
        '🧮 再計算対象フィールド:',
        computedFields.map((f) => f.id)
      )

      // 計算フィールドを再評価
      const updatedContext = evaluateComputedFields(computedFields, newContext)

      console.log('✅ 再計算完了:', {
        originalKeys: Object.keys(context),
        updatedKeys: Object.keys(updatedContext),
        changes: Object.keys(updatedContext).filter((key) => context[key] !== updatedContext[key])
      })

      return updatedContext
    },
    []
  )

  /**
   * バッチ更新（複数フィールドの同時変更）
   */
  const batchUpdate = useCallback(
    (
      updates: Record<string, number | string | boolean | undefined>,
      fields: Field[],
      context: EvaluationContext
    ): EvaluationContext => {
      console.log('🔄 バッチ更新開始:', { updates, context })

      // 新しいコンテキストを作成
      const newContext: EvaluationContext = { ...context, ...updates }

      // 依存グラフを構築
      const graph = buildDependencyGraph(fields)

      // 変更されたフィールドに依存している全フィールドを取得
      const allDependents = new Set<string>()
      for (const fieldId of Object.keys(updates)) {
        const dependents = getAllDependents(fieldId, graph)
        dependents.forEach((dep) => allDependents.add(dep))
      }

      console.log('📊 バッチ依存関係:', {
        changedFields: Object.keys(updates),
        dependents: Array.from(allDependents)
      })

      // 依存先の計算フィールドを再評価
      const computedFields = fields.filter((f) => f.type === 'computed' && allDependents.has(f.id))
      console.log(
        '🧮 バッチ再計算対象フィールド:',
        computedFields.map((f) => f.id)
      )

      // 計算フィールドを再評価
      const updatedContext = evaluateComputedFields(computedFields, newContext)

      console.log('✅ バッチ更新完了:', {
        originalKeys: Object.keys(context),
        updatedKeys: Object.keys(updatedContext),
        changes: Object.keys(updatedContext).filter((key) => context[key] !== updatedContext[key])
      })

      return updatedContext
    },
    []
  )

  /**
   * 依存関係の検証
   */
  const validateDependencies = useCallback((fields: Field[]): { valid: boolean; errors: string[] } => {
    const graph = buildDependencyGraph(fields)
    const errors: string[] = []

    // 循環参照チェック
    for (const field of fields) {
      if (field.type === 'computed' && field.formula) {
        const deps = graph[field.id] || new Set()
        for (const dep of deps) {
          if (getAllDependents(dep, graph).has(field.id)) {
            errors.push(`循環参照が検出されました: ${field.label} -> ${dep}`)
          }
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }, [])

  return {
    evaluateAll,
    recalculate,
    batchUpdate,
    validateDependencies
  }
}
