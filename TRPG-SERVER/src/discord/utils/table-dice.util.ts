import { DiceResult, rollDice } from './dice.util'

/**
 * テーブル項目
 */
export interface TableEntry {
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

/**
 * テーブルロール結果
 */
export interface TableRollResult {
  /**
   * ダイスロール結果
   */
  diceResult: DiceResult

  /**
   * 選択されたテーブル項目
   */
  tableEntry: TableEntry
}

/**
 * テーブルからランダムに選択する
 * @param table テーブルエントリの配列
 * @param diceCount ダイスの数
 * @param diceFaces ダイスの面数
 * @returns テーブルロール結果
 */
export function rollOnTable(table: TableEntry[], diceCount: number, diceFaces: number): TableRollResult {
  // ダイスをロール
  const diceResult = rollDice(diceCount, diceFaces)

  // 出目に対応する項目を探す
  const tableEntry = table.find((entry) => diceResult.total >= entry.min && diceResult.total <= entry.max)

  if (!tableEntry) {
    throw new Error(`テーブルに ${diceResult.total} の結果に対応する項目がありません`)
  }

  return {
    diceResult,
    tableEntry
  }
}
