/**
 * キャラクター関連の型定義
 */

/**
 * キャラクター属性の型定義
 */
export type CharacterAttribute = {
  [key: string]: string | number | boolean | null | undefined
}

/**
 * 更新可能なプライマリフィールド
 */
export type UpdatePrimary = 'status' | 'parameter' | 'skill'

/**
 * キャラクターインターface
 */
export interface Character {
  /**
   * キャラクターID（MongoDBの_idフィールド）
   */
  _id?: string

  /**
   * キャラクターID（ユニーク）
   */
  characterId: string

  /**
   * キャラクター名
   */
  characterName: string

  /**
   * ゲームシステムID
   */
  gameSystemId: string

  /**
   * DiscordユーザーID
   */
  discordUserId: string

  /**
   * DiscordチャンネルID
   */
  discordChannelId: string

  /**
   * ステータス
   */
  status: Record<string, CharacterAttribute> | Record<string, unknown>

  /**
   * スキル
   */
  skill?: Record<string, CharacterAttribute> | Record<string, unknown>

  /**
   * パラメーター
   */
  parameter?: Record<string, CharacterAttribute> | Record<string, unknown>

  /**
   * アイテム
   */
  item?: Record<string, CharacterAttribute> | Record<string, unknown>

  /**
   * 説明・備考
   */
  description?: Record<string, CharacterAttribute> | Record<string, unknown>

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
 * キャラクター作成DTO
 */
export interface CreateCharacterDto {
  characterId: string
  discordUserId: string
  discordChannelId: string
  characterName: string
  gameSystemId: string
  status?: CharacterAttribute
  parameter?: CharacterAttribute
  skill?: CharacterAttribute
}

/**
 * キャラクター作成入力DTO（部分的に入力可能）
 */
export interface PartialInputCharacterDto {
  characterId?: string
  discordUserId?: string
  discordChannelId?: string
  characterName?: string
  gameSystemId?: string
  status?: CharacterAttribute
  parameter?: CharacterAttribute
  skill?: CharacterAttribute
  item?: CharacterAttribute
  description?: CharacterAttribute
}

/**
 * キャラクター更新DTO
 */
export interface UpdateCharacterDto {
  characterName?: string
  gameSystemId?: string
  status?: Record<string, CharacterAttribute> | Record<string, unknown>
  skill?: Record<string, CharacterAttribute> | Record<string, unknown>
  parameter?: Record<string, CharacterAttribute> | Record<string, unknown>
  item?: Record<string, CharacterAttribute> | Record<string, unknown>
  description?: Record<string, CharacterAttribute> | Record<string, unknown>
}
