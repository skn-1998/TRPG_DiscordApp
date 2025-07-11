// キャラクターシートテンプレートの型定義
export interface CellData {
  id: string
  name: string // セルの名前（例：INT、STR）
  value: string // セルの値（例：1d6、[STR]×5）
  formula?: string // 計算式
  displayValue?: string // 表示値
  type: 'stat' | 'skill' | 'attribute' | 'text' | 'number' | 'calculated'
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
  readonly?: boolean
  style?: {
    backgroundColor?: string
    textColor?: string
    fontSize?: string
    fontWeight?: string
    textAlign?: 'left' | 'center' | 'right'
    border?: string
  }
}

export interface CharacterSheetTemplate {
  id: string
  name: string
  gameSystemId: string
  version: string
  author: string
  description?: string
  gridSize: {
    rows: number
    cols: number
  }
  cells: CellData[]
  createdAt: string
  updatedAt: string
}

export interface CharacterSheetInstance {
  id: string
  characterId: string
  templateId: string
  values: Record<string, any> // セルIDをキーとした値のマップ
  calculatedValues: Record<string, any> // 計算結果
  createdAt: string
  updatedAt: string
}

export interface CellReference {
  cellId: string
  cellName: string
  value: any
}