/**
 * ユーザー関連の型定義
 */

/**
 * ユーザーインターface
 */
export interface User {
  /**
   * ユーザーID（MongoDBの_idフィールド）
   */
  _id?: string

  /**
   * DiscordユーザーID
   */
  discordUserId: string

  /**
   * ユーザー名
   */
  name: string

  /**
   * アバターハッシュ
   */
  avatarHash?: string

  /**
   * 所有キャラクターIDリスト
   */
  characterIds: string[]

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
 * ユーザー作成用DTO
 */
export interface CreateUserDto {
  discordUserId: string
  name: string
  avatarHash?: string
  characterIds?: string[]
}

/**
 * ユーザー更新用DTO
 */
export interface UpdateUserDto {
  name?: string
  avatarHash?: string
  characterIds?: string[]
}
