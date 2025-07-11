// テンプレート関連の型定義

export interface CellTemplate {
  id: string
  name: string                    // セル名（例：INT, STR）
  type: 'number' | 'text' | 'formula' | 'dice' // 入力タイプ
  defaultValue?: string | number  // デフォルト値
  formula?: string               // 計算式（例：[STR]×5）
  validation?: {
    min?: number
    max?: number
    required?: boolean
  }
  style?: {
    backgroundColor?: string
    textColor?: string
    fontSize?: number
  }
}

export interface GridTemplate {
  id: string
  name: string                   // テンプレート名
  gameSystem: string            // 対応ゲームシステム
  description?: string          // 説明
  dimensions: {
    rows: number
    cols: number
  }
  cells: Map<string, CellTemplate> // セル座標 -> セル定義
  createdAt: Date
  updatedAt: Date
}

export interface ParseResult {
  references: string[]           // 参照しているセル名
  expression: string            // 計算式
  isValid: boolean              // 構文の有効性
  error?: string               // エラーメッセージ
}

export interface DiceResult {
  notation: string              // ダイス記法
  rolls: number[]              // ダイスロール結果
  total: number                // 合計値
  modifier: number             // 修正値
}

// セル座標のユーティリティ関数
export function createCellKey(row: number, col: number): string {
  return `${row},${col}`
}

export function parseCellKey(key: string): { row: number; col: number } {
  const [row, col] = key.split(',').map(Number)
  return { row, col }
}

// 空のテンプレート作成
export function createEmptyTemplate(): GridTemplate {
  return {
    id: '',
    name: '',
    gameSystem: 'Generic',
    description: '',
    dimensions: { rows: 10, cols: 6 },
    cells: new Map(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

// セルテンプレートの作成
export function createCellTemplate(
  id: string,
  name: string,
  type: CellTemplate['type'] = 'text'
): CellTemplate {
  return {
    id,
    name,
    type,
    defaultValue: type === 'number' ? 0 : '',
    validation: {
      required: false
    },
    style: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      fontSize: 14
    }
  }
}