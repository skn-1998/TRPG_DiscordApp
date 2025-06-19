/**
 * ダイスロール関連の型定義
 */

/**
 * ダイスロールテキストインターface
 */
export interface DiceRollText {
  /**
   * ダイスロールテキストID（MongoDBの_idフィールド）
   */
  _id?: string

  /**
   * テキストID（ユニーク）
   */
  textId: string

  /**
   * DiscordチャンネルID
   */
  discordChannelId: string

  /**
   * キャラクターID
   */
  characterId?: string

  /**
   * ダイスロール結果
   */
  result: number

  /**
   * ダイスロール式
   */
  diceRoll: string

  /**
   * テキスト内容
   */
  text: string

  /**
   * ゲームシステムID
   */
  gameSystemId?: string

  /**
   * シークレットダイスかどうか
   */
  isSecret: boolean

  /**
   * 作成日時
   */
  createdAt: Date

  /**
   * 更新日時
   */
  updatedAt?: Date
}

/**
 * ダイスロールチャンネルインターface
 */
export interface DiceRollChannel {
  /**
   * ダイスロールチャンネルID（MongoDBの_idフィールド）
   */
  _id?: string

  /**
   * DiscordチャンネルID（ユニーク）
   */
  discordChannelId: string

  /**
   * キャラクターIDリスト
   */
  characterIds: string[]

  /**
   * テキストIDリスト
   */
  textIds: string[]

  /**
   * 埋め込みメッセージID
   */
  embedId: string

  /**
   * ゲームシステムID
   */
  gameSystemId?: string

  /**
   * 作成日時
   */
  createdAt?: Date

  /**
   * 更新日時
   */
  updatedAt?: Date
}

/**
 * ダイスロールテキスト作成DTO
 */
export interface CreateDiceRollTextDto {
  textId: string
  discordChannelId: string
  characterId?: string
  result: number
  diceRoll: string
  text: string
  gameSystemId?: string
  isSecret?: boolean
}

/**
 * ダイスロールチャンネル作成DTO
 */
export interface CreateDiceRollChannelDto {
  discordChannelId: string
  characterIds?: string[]
  textIds?: string[]
  embedId?: string
  gameSystemId?: string
}

/**
 * ダイスロールテキスト更新DTO
 */
export interface UpdateDiceRollTextDto {
  characterId?: string
  result?: number
  diceRoll?: string
  text?: string
  gameSystemId?: string
  isSecret?: boolean
}

/**
 * ダイスロールチャンネル更新DTO
 */
export interface UpdateDiceRollChannelDto {
  characterIds?: string[]
  textIds?: string[]
  embedId?: string
  gameSystemId?: string
}

/**
 * ダイスロール実行リクエスト
 */
export interface DiceRollRequest {
  /**
   * ダイスロール式（例: "1d20+5"）
   */
  diceRoll: string

  /**
   * キャラクターID
   */
  characterId?: string

  /**
   * DiscordチャンネルID
   */
  discordChannelId: string

  /**
   * 追加テキスト
   */
  text?: string

  /**
   * ゲームシステムID
   */
  gameSystemId?: string

  /**
   * シークレットダイスかどうか
   */
  isSecret?: boolean
}

/**
 * ダイスロール実行レスポンス
 */
export interface DiceRollResponse {
  /**
   * 実行成功フラグ
   */
  success: boolean

  /**
   * ダイスロール結果
   */
  result?: number

  /**
   * 作成されたダイスロールテキスト
   */
  diceRollText?: DiceRollText

  /**
   * エラーメッセージ
   */
  error?: string

  /**
   * メッセージ
   */
  message?: string
}
