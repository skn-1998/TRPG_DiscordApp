/**
 * JWTトークンのペイロードモデル
 */
export interface JwtTokenPayload {
  /**
   * ユーザー名
   */
  username: string;
  
  /**
   * DiscordユーザーID
   */
  discordUserId: string;
  
  /**
   * トークン発行日時（タイムスタンプ）
   * JWT標準フィールド
   */
  iat?: number;
  
  /**
   * トークン有効期限（タイムスタンプ）
   * JWT標準フィールド
   */
  exp?: number;
} 