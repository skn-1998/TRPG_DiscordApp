/**
 * ダイスロールリクエスト
 */
export interface DiceRollRequest {
  /**
   * キャラクターID
   */
  characterId?: string

  /**
   * キャラクター名
   */
  characterName?: string

  /**
   * ダイス記法
   */
  notation: string

  /**
   * キャラクター画像URL
   */
  imageUrl?: string

  /**
   * スキル名
   */
  skillName?: string

  /**
   * 目標値
   */
  targetValue?: string
}

/**
 * ダイスロール結果
 */
export interface DiceRollResult {
  /**
   * 結果の値
   */
  result: number

  /**
   * 成功判定 (1: 成功, 2: ハード成功, 3: イクストリーム成功, 4: クリティカル, -1: 失敗, -2: ファンブル)
   */
  success?: number

  /**
   * ダイス出目
   */
  rolls?: number[]

  /**
   * ダイス記法
   */
  notation?: string
}
