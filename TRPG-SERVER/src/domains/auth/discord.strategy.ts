import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, VerifyCallback } from 'passport-discord'
import { AuthService } from './services/auth.service'
import { DiscordUserProfile } from './models/discord-user.model'

/**
 * Discord OAuth2認証ストラテジー
 */
@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  private readonly logger = new Logger(DiscordStrategy.name)

  constructor(
    private readonly authService: AuthService,
    private readonly _configService: ConfigService
  ) {
    super({
      clientID: _configService.get<string>('DISCORD_APPLICATIONID'),
      clientSecret: _configService.get<string>('DISCORD_SECRET'),
      callbackURL: _configService.get<string>('DISCORD_CALLBACK_URL') || 'http://localhost:3000/auth/discord/callback',
      scope: ['identify', 'email', 'guilds']
    })

    // configServiceが使用されていることをTypeScriptコンパイラに示すためのダミー処理
    this.logConfig()
  }

  /**
   * 設定ログ出力用のプライベートメソッド
   * TypeScriptコンパイラが未使用変数警告を出さないようにするためのメソッド
   */
  private logConfig(): void {
    const applicationId = this._configService.get<string>('DISCORD_APPLICATIONID')
    this.logger.debug(`Discord Strategy設定 - Application ID: ${applicationId}`)
    this.logger.debug(`Discord Strategy設定 - Scope: identify, email, guilds`)
    if (!applicationId) {
      this.logger.warn('Warning: DISCORD_APPLICATIONID is not configured')
    }
  }

  /**
   * Discord認証後に呼び出されるバリデーション関数
   * @param accessToken Discordアクセストークン
   * @param refreshToken Discordリフレッシュトークン
   * @param profile Discordプロファイル
   * @param done コールバック関数
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: DiscordUserProfile,
    done: VerifyCallback
  ): Promise<void> {
    try {
      this.logger.debug(`Discord認証検証開始: ${profile.username}`)
      this.logger.debug(`アクセストークン取得済み: ${accessToken ? 'あり' : 'なし'}`)

      const user = await this.authService.validateDiscordUser(accessToken, refreshToken, profile)
      // アクセストークンを一時的に保存（セッションまたはDBに保存するのが理想）
      user.accessToken = accessToken

      this.logger.debug(`Discord認証検証完了: ${profile.username}`)
      done(null, user)
    } catch (error) {
      this.logger.error(`Discord認証検証エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      done(error, null)
    }
  }
}
