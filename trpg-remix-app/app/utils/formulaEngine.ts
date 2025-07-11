import { CellData, CellReference } from '~/types/characterSheet'

// セル参照パターン（[セル名]）
const CELL_REFERENCE_PATTERN = /\[([A-Za-z_][A-Za-z0-9_]*)\]/g

// ダイス計算パターン（例：1d6、2d10）
const DICE_PATTERN = /(\d+)d(\d+)/gi

// 基本的な数式計算パターン
const MATH_PATTERN = /^[0-9+\-*/().\s\[\]A-Za-z_]*$/

/**
 * ダイスを振る
 * @param count ダイスの数
 * @param sides ダイスの面数
 * @returns ダイスの結果
 */
export function rollDice(count: number, sides: number): number {
  let total = 0
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1
  }
  return total
}

/**
 * 式内のダイス計算を実行
 * @param formula 計算式
 * @returns ダイス計算結果を含む式
 */
export function evaluateDiceInFormula(formula: string): string {
  return formula.replace(DICE_PATTERN, (match, count, sides) => {
    const diceCount = parseInt(count, 10)
    const diceSides = parseInt(sides, 10)
    return rollDice(diceCount, diceSides).toString()
  })
}

/**
 * セル参照を解決
 * @param formula 計算式
 * @param cellReferences セル参照マップ
 * @returns セル参照を解決した式
 */
export function resolveCellReferences(
  formula: string,
  cellReferences: Record<string, CellReference>
): string {
  return formula.replace(CELL_REFERENCE_PATTERN, (match, cellName) => {
    const reference = cellReferences[cellName]
    if (reference && reference.value !== undefined) {
      return reference.value.toString()
    }
    return '0' // 参照が見つからない場合は0を返す
  })
}

/**
 * 数式を評価
 * @param formula 計算式
 * @returns 計算結果
 */
export function evaluateFormula(formula: string): number {
  // 安全性チェック
  if (!MATH_PATTERN.test(formula)) {
    throw new Error('Invalid formula')
  }

  try {
    // eval の代わりに Function を使用してより安全に計算
    const result = new Function(`return ${formula}`)()
    return typeof result === 'number' ? result : 0
  } catch (error) {
    console.error('Formula evaluation error:', error)
    return 0
  }
}

/**
 * セル値を計算
 * @param cell セルデータ
 * @param cellReferences セル参照マップ
 * @returns 計算結果
 */
export function calculateCellValue(
  cell: CellData,
  cellReferences: Record<string, CellReference>
): any {
  if (!cell.value) return ''

  // セル参照が含まれている場合
  if (CELL_REFERENCE_PATTERN.test(cell.value)) {
    const resolvedFormula = resolveCellReferences(cell.value, cellReferences)
    
    // ダイス計算が含まれている場合
    if (DICE_PATTERN.test(resolvedFormula)) {
      const diceResolved = evaluateDiceInFormula(resolvedFormula)
      return evaluateFormula(diceResolved)
    }
    
    // 数式として評価
    return evaluateFormula(resolvedFormula)
  }

  // ダイス計算のみの場合
  if (DICE_PATTERN.test(cell.value)) {
    return evaluateDiceInFormula(cell.value)
  }

  // 数式として評価可能な場合
  if (MATH_PATTERN.test(cell.value) && /[+\-*/()]/.test(cell.value)) {
    return evaluateFormula(cell.value)
  }

  // 数値として解釈可能な場合
  const numValue = parseFloat(cell.value)
  if (!isNaN(numValue)) {
    return numValue
  }

  // その他の場合はそのまま返す
  return cell.value
}

/**
 * 全セルの値を計算
 * @param cells セルデータ配列
 * @returns 計算結果マップ
 */
export function calculateAllCellValues(cells: CellData[]): Record<string, any> {
  const results: Record<string, any> = {}
  const cellReferences: Record<string, CellReference> = {}

  // 複数回計算を実行して循環参照を解決
  const maxIterations = 10
  let iteration = 0

  while (iteration < maxIterations) {
    let hasChanges = false

    for (const cell of cells) {
      const oldValue = results[cell.id]
      const newValue = calculateCellValue(cell, cellReferences)
      
      if (oldValue !== newValue) {
        results[cell.id] = newValue
        hasChanges = true
      }

      // セル参照マップを更新
      cellReferences[cell.name] = {
        cellId: cell.id,
        cellName: cell.name,
        value: results[cell.id]
      }
    }

    if (!hasChanges) break
    iteration++
  }

  return results
}

/**
 * 循環参照をチェック
 * @param cells セルデータ配列
 * @returns 循環参照があるかどうか
 */
export function hasCircularReference(cells: CellData[]): boolean {
  const dependencies: Record<string, Set<string>> = {}

  // 依存関係を構築
  for (const cell of cells) {
    dependencies[cell.name] = new Set()
    
    const matches = cell.value.match(CELL_REFERENCE_PATTERN)
    if (matches) {
      for (const match of matches) {
        const cellName = match.slice(1, -1) // [cellName] -> cellName
        dependencies[cell.name].add(cellName)
      }
    }
  }

  // 循環参照をチェック
  function hasCycle(node: string, visited: Set<string>, recursionStack: Set<string>): boolean {
    if (recursionStack.has(node)) return true
    if (visited.has(node)) return false

    visited.add(node)
    recursionStack.add(node)

    const deps = dependencies[node]
    if (deps) {
      for (const dep of deps) {
        if (hasCycle(dep, visited, recursionStack)) {
          return true
        }
      }
    }

    recursionStack.delete(node)
    return false
  }

  const visited = new Set<string>()
  for (const cellName of Object.keys(dependencies)) {
    if (hasCycle(cellName, visited, new Set())) {
      return true
    }
  }

  return false
}