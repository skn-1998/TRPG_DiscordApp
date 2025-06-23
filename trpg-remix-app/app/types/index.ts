/**
 * 型定義のインデックスファイル
 *
 * このファイルからすべての型定義をインポートできます
 */

// ユーザー関連の型
export type { User, CreateUserDto, UpdateUserDto } from './user'

// キャラクター関連の型
export type {
  Character,
  CharacterAttribute,
  UpdatePrimary,
  CreateCharacterDto,
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
  LoginResponse
} from './auth'

// ダイスロール関連の型
export type {
  DiceRollText,
  DiceRollChannel,
  CreateDiceRollTextDto,
  CreateDiceRollChannelDto,
  UpdateDiceRollTextDto,
  UpdateDiceRollChannelDto,
  DiceRollRequest,
  DiceRollResponse
} from './dice-roll'

// ゲームシステム関連の型
export type { GameSystemJSON } from './gameSystem'

// 共通の型定義
export interface ApiResponse<T = unknown> {
  /**
   * API実行成功フラグ
   */
  success: boolean

  /**
   * レスポンスデータ
   */
  data?: T

  /**
   * エラーメッセージ
   */
  error?: string

  /**
   * メッセージ
   */
  message?: string

  /**
   * HTTPステータスコード
   */
  statusCode?: number
}

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
