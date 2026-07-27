/**
 * 型定義のインデックスファイル
 *
 * このファイルからすべての型定義をインポートできます
 */

// キャラクター関連の型
export type {
  Character,
  CharacterAttribute,
  UpdatePrimary,
  PartialInputCharacterDto,
  UpdateCharacterDto
} from './character'

// 認証関連の型
export type {
  DiscordUserProfile,
  DiscordAuthResponse,
  JwtTokenPayload,
  AuthState,
  LoginRequest,
  LoginData,
  LoginResponse
} from './auth'

// ゲームシステム関連の型
export type { GameSystemJSON } from './gameSystem'

/**
 * ページネーション用の型
 */
export interface PaginationParams {
  /**
   * ページ番号（1から開始）
   */
  page?: number

  /**
   * 1ページあたりのアイテム数
   */
  limit?: number

  /**
   * ソートフィールド
   */
  sortBy?: string

  /**
   * ソート順序
   */
  sortOrder?: 'asc' | 'desc'
}

/**
 * ページネーション付きレスポンス
 */
export interface PaginatedResponse<T> {
  /**
   * データ配列
   */
  items: T[]

  /**
   * 総アイテム数
   */
  totalItems: number

  /**
   * 総ページ数
   */
  totalPages: number

  /**
   * 現在のページ番号
   */
  currentPage: number

  /**
   * 1ページあたりのアイテム数
   */
  itemsPerPage: number

  /**
   * 次のページが存在するか
   */
  hasNextPage: boolean

  /**
   * 前のページが存在するか
   */
  hasPreviousPage: boolean
}

export * from './discord'
