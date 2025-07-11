// シート関連の型定義

export interface CellValue {
  id: string
  value: string | number
  calculatedValue?: number      // 計算結果
  error?: string               // エラーメッセージ
}

export interface CharacterSheet {
  id: string
  templateId: string
  characterId: string
  values: Map<string, CellValue>
  lastCalculated: Date
}

export interface SheetValidationResult {
  isValid: boolean
  errors: Array<{
    cellId: string
    message: string
  }>
}

export interface CalculationDependency {
  cellId: string
  dependencies: string[]       // 依存するセルID
  dependents: string[]        // 依存されるセルID
}

// セル値の作成
export function createCellValue(
  id: string,
  value: string | number = ''
): CellValue {
  return {
    id,
    value,
    calculatedValue: typeof value === 'number' ? value : undefined
  }
}

// 空のシート作成
export function createEmptySheet(
  templateId: string,
  characterId: string
): CharacterSheet {
  return {
    id: '',
    templateId,
    characterId,
    values: new Map(),
    lastCalculated: new Date()
  }
}

// セル値の取得（デフォルト値対応）
export function getCellValueWithDefault(
  sheet: CharacterSheet,
  cellId: string,
  defaultValue: string | number = ''
): string | number {
  const cellValue = sheet.values.get(cellId)
  if (cellValue) {
    return cellValue.calculatedValue !== undefined 
      ? cellValue.calculatedValue 
      : cellValue.value
  }
  return defaultValue
}

// セル値の設定
export function setCellValue(
  sheet: CharacterSheet,
  cellId: string,
  value: string | number
): CharacterSheet {
  const newValues = new Map(sheet.values)
  newValues.set(cellId, createCellValue(cellId, value))
  
  return {
    ...sheet,
    values: newValues,
    lastCalculated: new Date()
  }
}

// 計算エラーの設定
export function setCellError(
  sheet: CharacterSheet,
  cellId: string,
  error: string
): CharacterSheet {
  const newValues = new Map(sheet.values)
  const existingValue = newValues.get(cellId) || createCellValue(cellId)
  
  newValues.set(cellId, {
    ...existingValue,
    error
  })
  
  return {
    ...sheet,
    values: newValues,
    lastCalculated: new Date()
  }
}