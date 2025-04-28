import { registerAs } from '@nestjs/config'
import { env } from './environment'

/**
 * 認証関連の設定
 */
export const AuthConfig = registerAs('auth', () => ({
  /**
   * JWT署名用の秘密鍵
   */
  jwtSecret: env.JWT_SECRET,

  /**
   * JWTトークンの有効期限（秒）
   */
  jwtExpiresIn: 3600 * 24, // 24時間

  /**
   * Discord認証設定
   */
  discord: {
    /**
     * DiscordアプリケーションID
     */
    applicationId: env.DISCORD_APPLICATIONID,

    /**
     * Discordシークレット
     */
    secret: env.DISCORD_SECRET,

    /**
     * 認証後リダイレクト先URL
     */
    callbackUrl: `${env.FRONTEND_URL}/auth/discord/callback`
  }
}))
