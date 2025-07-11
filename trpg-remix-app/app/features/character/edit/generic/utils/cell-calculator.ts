// セル計算機能

import { 
  GridTemplate, 
  CharacterSheet, 
  CellValue, 
  CalculationDependency,
  setCellValue,
  setCellError,
  getCellValueWithDefault
} from '../types'
import { formulaParser, diceParser } from './formula-parser'

export class CellCalculator {
  /**
   * シート全体の値を再計算
   */
  calculateSheet(template: GridTemplate, sheet: CharacterSheet): CharacterSheet {
    const dependencies = this.buildDependencyGraph(template)
    
    // 循環参照チェック
    if (this.hasCircularReference(dependencies)) {
      throw new Error('循環参照が検出されました')
    }
    
    // 計算順序を決定（トポロジカルソート）
    const calculationOrder = this.getCalculationOrder(dependencies)
    
    let updatedSheet = { ...sheet }
    
    // 計算順序に従って各セルを処理
    for (const cellId of calculationOrder) {
      const cellTemplate = this.findCellTemplate(template, cellId)
      if (!cellTemplate) continue
      
      try {
        const calculatedValue = this.calculateCell(cellTemplate, updatedSheet)
        if (calculatedValue !== undefined) {
          updatedSheet = this.updateCellValue(updatedSheet, cellId, calculatedValue)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '計算エラー'
        updatedSheet = setCellError(updatedSheet, cellId, errorMessage)
      }
    }
    
    return updatedSheet
  }

  /**
   * 単一セルの値を計算
   */
  calculateCell(cellTemplate: any, sheet: CharacterSheet): number | string | undefined {
    switch (cellTemplate.type) {
      case 'number':
      case 'text':
        // 入力値をそのまま使用
        return undefined
        
      case 'formula':
        if (!cellTemplate.formula) {
          throw new Error('計算式が設定されていません')
        }
        return this.calculateFormula(cellTemplate.formula, sheet)
        
      case 'dice':
        if (!cellTemplate.formula) {
          throw new Error('ダイス記法が設定されていません')
        }
        return diceParser.rollDice(cellTemplate.formula)
        
      default:
        return undefined
    }
  }

  /**
   * 数式を計算
   */
  private calculateFormula(formula: string, sheet: CharacterSheet): number {
    const parseResult = formulaParser.parseFormula(formula)
    
    if (!parseResult.isValid) {
      throw new Error(parseResult.error || '無効な数式です')
    }
    
    // 参照値を取得
    const referenceValues = new Map<string, number>()
    for (const reference of parseResult.references) {
      const value = getCellValueWithDefault(sheet, reference, 0)
      const numValue = typeof value === 'number' ? value : parseFloat(value.toString())
      
      if (isNaN(numValue)) {
        throw new Error(`参照されたセル "${reference}" の値が数値ではありません`)
      }
      
      referenceValues.set(reference, numValue)
    }
    
    return formulaParser.calculateFormula(formula, referenceValues)
  }

  /**
   * 依存関係グラフを構築
   */
  private buildDependencyGraph(template: GridTemplate): Map<string, CalculationDependency> {
    const dependencies = new Map<string, CalculationDependency>()
    
    // 各セルの依存関係を解析
    for (const [cellKey, cellTemplate] of template.cells) {
      const dependency: CalculationDependency = {
        cellId: cellTemplate.id,
        dependencies: [],
        dependents: []
      }
      
      if (cellTemplate.type === 'formula' && cellTemplate.formula) {
        const parseResult = formulaParser.parseFormula(cellTemplate.formula)
        dependency.dependencies = parseResult.references
      }
      
      dependencies.set(cellTemplate.id, dependency)
    }
    
    // 逆参照（dependents）を設定
    for (const [cellId, dependency] of dependencies) {
      for (const depId of dependency.dependencies) {
        const depCell = dependencies.get(depId)
        if (depCell && !depCell.dependents.includes(cellId)) {
          depCell.dependents.push(cellId)
        }
      }
    }
    
    return dependencies
  }

  /**
   * 循環参照チェック
   */
  private hasCircularReference(dependencies: Map<string, CalculationDependency>): boolean {
    const dependencyMap = new Map<string, string[]>()
    
    for (const [cellId, dependency] of dependencies) {
      dependencyMap.set(cellId, dependency.dependencies)
    }
    
    return formulaParser.checkCircularReference(dependencyMap)
  }

  /**
   * 計算順序を決定（トポロジカルソート）
   */
  private getCalculationOrder(dependencies: Map<string, CalculationDependency>): string[] {
    const visited = new Set<string>()
    const result: string[] = []
    
    const visit = (cellId: string) => {
      if (visited.has(cellId)) return
      
      visited.add(cellId)
      
      const dependency = dependencies.get(cellId)
      if (dependency) {
        // 依存関係を先に処理
        for (const depId of dependency.dependencies) {
          visit(depId)
        }
      }
      
      result.push(cellId)
    }
    
    for (const cellId of dependencies.keys()) {
      visit(cellId)
    }
    
    return result
  }

  /**
   * テンプレートからセルを検索
   */
  private findCellTemplate(template: GridTemplate, cellId: string): any {
    for (const [, cellTemplate] of template.cells) {
      if (cellTemplate.id === cellId) {
        return cellTemplate
      }
    }
    return null
  }

  /**
   * セル値を更新
   */
  private updateCellValue(
    sheet: CharacterSheet,
    cellId: string,
    value: number | string
  ): CharacterSheet {
    const newValues = new Map(sheet.values)
    const existingValue = newValues.get(cellId)
    
    const cellValue: CellValue = {
      id: cellId,
      value: existingValue?.value || value,
      calculatedValue: typeof value === 'number' ? value : undefined,
      error: undefined
    }
    
    newValues.set(cellId, cellValue)
    
    return {
      ...sheet,
      values: newValues,
      lastCalculated: new Date()
    }
  }
}

// シングルトンインスタンス
export const cellCalculator = new CellCalculator()