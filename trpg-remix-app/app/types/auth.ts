import { DomainApiResponse } from './api'

/**
 * 認証関連の型定義
 */

/**
 * Discordから取得するユーザープロファイル
 */
export interface DiscordUserProfile {
  /**
   * DiscordユーザーID
   */
  id: string

  /**
   * ユーザー名
   */
  username: string

  /**
   * アバターハッシュ
   */
  avatar?: string

  /**
   * Discordの識別子
   */
  discriminator?: string

  /**
   * メールアドレス（スコープに含まれる場合）
   */
  email?: string

  /**
   * メール検証済みフラグ
   */
  verified?: boolean
}

/**
 * Discord認証レスポンス
 */
export interface DiscordAuthResponse {
  /**
   * アクセストークン
   */
  access_token: string

  /**
   * トークンタイプ（通常は "Bearer"）
   */
  token_type: string

  /**
   * トークン有効期限（秒）
   */
  expires_in: number

  /**
   * リフレッシュトークン
   */
  refresh_token: string

  /**
   * スコープ
   */
  scope: string
}

/**
 * JWTトークンのペイロードモデル
 */
export interface JwtTokenPayload {
  /**
   * ユーザー名
   */
  username: string

  /**
   * DiscordユーザーID
   */
  discordUserId: string

  /**
   * トークン発行日時（タイムスタンプ）
   * JWT標準フィールド
   */
  iat?: number

  /**
   * トークン有効期限（タイムスタンプ）
   * JWT標準フィールド
   */
  exp?: number
}

/**
 * ログイン状態管理用インターface
 */
export interface AuthState {
  /**
   * ログイン状態
   */
  isAuthenticated: boolean

  /**
   * JWTトークン
   */
  token?: string

  /**
   * ユーザー情報
   */
  user?: DiscordUserProfile

  /**
   * トークンペイロード
   */
  tokenPayload?: JwtTokenPayload
}

/**
 * ログインリクエスト
 */
export interface LoginRequest {
  /**
   * Discord認証コード
   */
  code: string

  /**
   * ステート（CSRF対策）
   */
  state?: string
}

/**
 * ログインレスポンス（新しいAPI型定義を使用）
 */
export type LoginResponse = DomainApiResponse<'auth'>
