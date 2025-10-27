// テンプレートバリデーション

import type { Field, Template, ValidationError } from '../types'
import { validateFormulaSyntax, extractDependencies } from './formulaEngine'
import { validateDiceFormula } from './diceRoller'
import { buildDependencyGraph, detectCircularDependency } from './dependencyGraph'

/**
 * フィールドIDの重複チェック
 */
function checkDuplicateIds(fields: Field[]): ValidationError[] {
  const errors: ValidationError[] = []
  const ids = new Set<string>()

  for (const field of fields) {
    if (ids.has(field.id)) {
      errors.push({
        field: field.id,
        message: `フィールドIDが重複しています: ${field.id}`,
        type: 'error'
      })
    }
    ids.add(field.id)
  }

  return errors
}

/**
 * フィールドIDの命名規則チェック
 */
function checkFieldIdFormat(fields: Field[]): ValidationError[] {
  const errors: ValidationError[] = []
  const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/

  for (const field of fields) {
    if (!pattern.test(field.id)) {
      errors.push({
        field: field.id,
        message: `フィールドIDは英数字とアンダースコアのみ使用可能です: ${field.id}`,
        type: 'error'
      })
    }
  }

  return errors
}

/**
 * 計算フィールドのバリデーション
 */
function validateComputedFields(fields: Field[]): ValidationError[] {
  const errors: ValidationError[] = []
  const fieldIds = new Set(fields.map((f) => f.id))

  for (const field of fields) {
    if (field.type !== 'computed') continue

    // 式の構文チェック
    const syntaxCheck = validateFormulaSyntax(field.formula)
    if (!syntaxCheck.valid) {
      errors.push({
        field: field.id,
        message: `式の構文エラー: ${syntaxCheck.error}`,
        type: 'error'
      })
    }

    // 依存フィールドの存在チェック
    const deps = extractDependencies(field.formula)
    for (const dep of deps) {
      if (!fieldIds.has(dep)) {
        errors.push({
          field: field.id,
          message: `未定義のフィールド参照: {${dep}}`,
          type: 'error'
        })
      }
    }
  }

  return errors
}

/**
 * ロールフィールドのバリデーション
 */
function validateRollFields(fields: Field[]): ValidationError[] {
  const errors: ValidationError[] = []

  for (const field of fields) {
    if (field.type !== 'roll') continue

    const check = validateDiceFormula(field.diceFormula)
    if (!check.valid) {
      errors.push({
        field: field.id,
        message: `ダイス式エラー: ${check.error}`,
        type: 'error'
      })
    }
  }

  return errors
}

/**
 * 循環参照チェック
 */
function checkCircularDependencies(fields: Field[]): ValidationError[] {
  const errors: ValidationError[] = []
  const graph = buildDependencyGraph(fields)
  const cycle = detectCircularDependency(graph)

  if (cycle) {
    errors.push({
      message: `循環参照が検出されました: ${cycle.join(' → ')}`,
      type: 'error'
    })
  }

  return errors
}

/**
 * テンプレート全体のバリデーション
 */
export function validateTemplate(template: Template): ValidationError[] {
  const errors: ValidationError[] = []

  // メタ情報チェック
  if (!template.id) errors.push({ message: 'テンプレートIDが必須です', type: 'error' })
  if (!template.name) errors.push({ message: 'テンプレート名が必須です', type: 'error' })
  if (!template.version) errors.push({ message: 'バージョンが必須です', type: 'error' })

  // フィールドチェック
  errors.push(...checkDuplicateIds(template.fields))
  errors.push(...checkFieldIdFormat(template.fields))
  errors.push(...validateComputedFields(template.fields))
  errors.push(...validateRollFields(template.fields))
  errors.push(...checkCircularDependencies(template.fields))

  return errors
}
