/**
 * ダイスロールリクエスト
 */
export interface DiceRollRequest {
  /**
   * チャンネルID
   */
  channelId: string

  /**
   * ダイスタイプ
   */
  diceType: string

  /**
   * ロール理由
   */
  reason?: string

  /**
   * ユーザーID
   */
  userId?: string

  /**
   * キャラクターID（後方互換性）
   */
  characterId?: string

  /**
   * キャラクター名（後方互換性）
   */
  characterName?: string

  /**
   * ダイス記法（後方互換性）
   */
  notation?: string

  /**
   * キャラクター画像URL（後方互換性）
   */
  imageUrl?: string

  /**
   * スキル名（後方互換性）
   */
  skillName?: string

  /**
   * 目標値（後方互換性）
   */
  targetValue?: string
}

/**
 * ダイスロール結果
 */
export interface DiceRollResult {
  /**
   * 処理成功フラグ
   */
  success?: boolean

  /**
   * 結果の値
   */
  total?: number

  /**
   * エラーメッセージ（失敗時）
   */
  error?: string

  /**
   * ダイスタイプ
   */
  diceType?: string

  /**
   * 詳細情報
   */
  details?: string

  /**
   * ロール理由
   */
  reason?: string

  /**
   * キャラクター名
   */
  characterName?: string

  /**
   * ロールID
   */
  rollId?: string

  /**
   * スキルロールフラグ
   */
  isSkillRoll?: boolean

  /**
   * スキル成功フラグ
   */
  skillSuccess?: boolean

  /**
   * 成功レベル
   */
  successLevel?: string

  /**
   * カスタムロールフラグ
   */
  isCustomRoll?: boolean

  /**
   * 結果の値（後方互換性）
   */
  result?: number

  /**
   * 成功判定 (1: 成功, 2: ハード成功, 3: イクストリーム成功, 4: クリティカル, -1: 失敗, -2: ファンブル)（後方互換性）
   */
  successNumber?: number

  /**
   * ダイス出目（後方互換性）
   */
  rolls?: number[]

  /**
   * ダイス記法（後方互換性）
   */
  notation?: string
}
