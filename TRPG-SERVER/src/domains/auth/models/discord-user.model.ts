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
