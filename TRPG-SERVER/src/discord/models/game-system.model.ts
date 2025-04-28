/**
 * ゲームシステム情報
 */
export interface GameSystem {
  /**
   * システムID
   */
  id: string

  /**
   * システム名
   */
  name: string

  /**
   * システムの説明
   */
  description?: string

  /**
   * デフォルトのダイスコマンド
   */
  defaultDiceCommand?: string

  /**
   * カスタムダイステーブル
   */
  customTables?: Record<string, GameSystemTable>
}

/**
 * ゲームシステムのテーブル
 */
export interface GameSystemTable {
  /**
   * テーブル名
   */
  name: string

  /**
   * テーブルの説明
   */
  description?: string

  /**
   * テーブルに使用するダイス（例: 2d6）
   */
  dice: string

  /**
   * テーブル項目
   */
  entries: GameSystemTableEntry[]
}

/**
 * ゲームシステムのテーブル項目
 */
export interface GameSystemTableEntry {
  /**
   * 最小値
   */
  min: number

  /**
   * 最大値
   */
  max: number

  /**
   * テーブル項目の内容
   */
  content: string
}
