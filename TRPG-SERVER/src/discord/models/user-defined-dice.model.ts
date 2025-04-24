/**
 * ユーザー定義ダイス
 */
export interface UserDefinedDice {
  /**
   * ユーザーID
   */
  userId: string

  /**
   * サーバーID
   */
  guildId: string

  /**
   * ダイス名
   */
  name: string

  /**
   * ダイスコマンド
   */
  command: string

  /**
   * 説明
   */
  description?: string

  /**
   * 作成日時
   */
  createdAt: Date

  /**
   * 更新日時
   */
  updatedAt: Date
}

/**
 * ユーザー定義ダイスの作成DTOインターフェース
 */
export interface CreateUserDefinedDiceDto {
  /**
   * ユーザーID
   */
  userId: string

  /**
   * サーバーID
   */
  guildId: string

  /**
   * ダイス名
   */
  name: string

  /**
   * ダイスコマンド
   */
  command: string

  /**
   * 説明
   */
  description?: string
}

/**
 * ユーザー定義ダイスの更新DTOインターフェース
 */
export interface UpdateUserDefinedDiceDto {
  /**
   * ダイスコマンド
   */
  command?: string

  /**
   * 説明
   */
  description?: string
}
