import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  Headers,
  Param,
  Logger,
  HttpStatus,
  BadRequestException,
  NotFoundException
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request as ExpressRequest, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './services/auth.service'
import { UserService } from '../user/user.service'
import { User } from '../user/models/user.model'
import { DiscordLoginDto } from './dto/discord-login.dto'
import { DiscordUserProfile } from './models/discord-user.model'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { JwtTokenPayload } from './models/auth.token.model'

// Expressのリクエスト型を拡張してユーザー情報を含める
interface RequestWithUser extends ExpressRequest {
  user: DiscordUserProfile & Record<string, unknown>
}

/**
 * 認証コントローラー
 * 認証関連のエンドポイントを提供
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Discord認証リダイレクトエンドポイント
   */
  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  async discordLogin(): Promise<void> {
    // このルートはDiscordの認証ページにリダイレクトするために空にしている
    this.logger.debug('Redirecting to Discord authentication')
  }

  /**
   * Discord認証コールバックエンドポイント
   * @param req リクエスト
   * @param res レスポンス
   */
  @Get('discord/callback')
  @UseGuards(AuthGuard('discord'))
  async discordLoginCallback(@Req() req: RequestWithUser, @Res() res: Response): Promise<void> {
    try {
      const profile = req.user as DiscordUserProfile

      if (!profile) {
        throw new BadRequestException('プロファイル情報が取得できませんでした')
      }

      const user: Partial<User> = {
        name: profile.username,
        discordUserId: profile.id,
        avatarHash: profile.avatar,
        characterIds: [],
        // Discordアクセストークンを保存
        discordAccessToken: '',
        discordRefreshToken: '',
        discordTokenExpiresAt: new Date(),
        discordTokenScope: ''
      }

      await this.authService.signInAndRegisterUserInfo(user)
      const jwt = await this.authService.generateJwt(user)

      const isProduction = this.configService.get<string>('NODE_ENV') === 'production'

      // 環境に応じたクッキー設定
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction, // 本番環境のみsecure
        sameSite: isProduction ? ('none' as const) : ('lax' as const), // 環境に応じて変更
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7日間
      }

      this.logger.debug(`Discord認証 - クッキー設定: ${JSON.stringify(cookieOptions)}`)

      // セキュアクッキーにJWTを設定
      res.cookie('jwt', jwt, cookieOptions)

      // フロントエンドページへリダイレクト
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || '/'
      res.redirect(frontendUrl)
    } catch (error) {
      this.logger.error(`Discord認証コールバックエラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      res.redirect('/auth-error')
    }
  }

  /**
   * トークン検証エンドポイント
   * @param authorization 認証ヘッダー
   * @returns JWTペイロード
   */
  @Get('validate-token')
  async validateToken(@Headers('Authorization') authorization: string) {
    try {
      return await this.authService.validateToken(authorization)
    } catch (error) {
      this.logger.error(`トークン検証エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      throw error
    }
  }

  /**
   * ログインエンドポイント
   * @param loginDto ログイン情報
   * @param res レスポンス
   */
  @Post('login')
  async login(@Body() loginDto: DiscordLoginDto, @Req() req: RequestWithUser, @Res() res: Response): Promise<void> {
    try {
      const { code } = loginDto

      if (!code) {
        throw new BadRequestException('認証コードが指定されていません')
      }

      const authData = await this.authService.authenticate(code)
      const userInfo = await this.authService.getUserInfo(authData.access_token)

      this.logger.debug(`User info: ${JSON.stringify(userInfo)}`)
      this.logger.debug(`Avatar hash from Discord: ${userInfo.avatar}`)

      // Discord Guild一覧を取得してログに出力
      try {
        this.logger.debug('Discord Guild一覧を取得中...')
        const guilds = await this.authService.getDiscordGuildsWithToken(authData.access_token)

        this.logger.debug(`✅ Discord Guild一覧取得成功: ${guilds.length}個のサーバー`)
        guilds.forEach((guild, index) => {
          this.logger.debug(`Guild ${index + 1}: ${guild.name} (ID: ${guild.id}, Owner: ${guild.owner})`)
        })
      } catch (guildError) {
        this.logger.error(
          `Discord Guild一覧の取得に失敗: ${guildError instanceof Error ? guildError.message : '不明なエラー'}`
        )
        // Guild取得の失敗はログイン全体を失敗させない
      }

      const user: Partial<User> = {
        name: userInfo.username,
        discordUserId: userInfo.id,
        avatarHash: userInfo.avatar,
        characterIds: [],
        // Discordアクセストークンを保存
        discordAccessToken: authData.access_token,
        discordRefreshToken: authData.refresh_token,
        discordTokenExpiresAt: new Date(Date.now() + authData.expires_in * 1000),
        discordTokenScope: authData.scope
      }

      this.logger.debug(`User object to save: ${JSON.stringify(user)}`)

      // 新しいトークン保存機能を使用
      await this.authService.signInAndRegisterUserInfoWithTokens(user, authData)
      const jwt = await this.authService.generateJwt(user)

      const isProduction = this.configService.get<string>('NODE_ENV') === 'production'
      const hostHeader = req.get('host') || ''

      // 環境に応じたクッキー設定
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction, // 本番環境のみsecure
        sameSite: isProduction ? ('none' as const) : ('lax' as const), // 環境に応じて変更
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7日間
        // ローカル環境でlocalhostアクセスの場合のみドメインを設定
        ...(!isProduction && hostHeader.includes('localhost') ? { domain: 'localhost' } : {})
      }

      this.logger.debug(`ログイン - Host: ${hostHeader}`)
      this.logger.debug(`ログイン - クッキー設定: ${JSON.stringify(cookieOptions)}`)

      // セキュアクッキーにJWTを設定
      res.cookie('jwt', jwt, cookieOptions)

      res.status(HttpStatus.OK).json({
        message: '認証成功',
        discordUserId: user.discordUserId,
        userName: user.name,
        token: jwt
      })
    } catch (error) {
      this.logger.error(`ログインエラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: '認証に失敗しました',
        error: error instanceof Error ? error.message : '不明なエラー'
      })
    }
  }

  /**
   * ログアウトエンドポイント
   * @param res レスポンス
   */
  @Post('logout')
  async logout(@Req() req: RequestWithUser, @Res() res: Response): Promise<void> {
    try {
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production'

      // 環境に応じたクッキー削除設定
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction, // 本番環境のみsecure
        sameSite: isProduction ? ('none' as const) : ('lax' as const), // 環境に応じて変更
        path: '/'
      }

      // IPv6/IPv4 デバッグ情報
      this.logger.debug(`Client IP: ${req.ip}`)
      this.logger.debug(`Host Header: ${req.get('host')}`)
      this.logger.debug(`X-Forwarded-For: ${req.get('X-Forwarded-For')}`)
      this.logger.debug(`Connection Remote Address: ${req.connection?.remoteAddress}`)
      this.logger.debug(`ログアウト - クッキー削除設定: ${JSON.stringify(cookieOptions)}`)

      // 基本的なクッキー削除
      res.clearCookie('jwt', cookieOptions)

      // IPv6/IPv4 対応の包括的削除
      const hostHeader = req.get('host') || ''
      const isLocalhost =
        hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1') || hostHeader.includes('::1')

      if (isLocalhost) {
        this.logger.debug(`ローカル環境でのクッキー削除 - Host: ${hostHeader}`)

        // まず、ドメイン指定なしで削除（最も確実）
        // ログイン時にドメイン指定なしで設定されたクッキーを削除
        res.clearCookie('jwt', { ...cookieOptions })
        res.clearCookie('jwt', { path: '/' })
        res.clearCookie('jwt', { httpOnly: true, path: '/' })
        res.clearCookie('jwt', { secure: false, path: '/' })
        this.logger.debug('ドメイン指定なしでクッキー削除試行')

        // IPアドレス経由の場合の特別対応
        if (hostHeader.includes('127.0.0.1') || hostHeader.includes('::1')) {
          const ipType = hostHeader.includes('127.0.0.1') ? 'IPv4' : 'IPv6'

          // 強制的に期限切れクッキーで上書き（複数パターン）
          const overwriteOptions = [
            {
              httpOnly: true,
              secure: false,
              sameSite: 'lax' as const,
              path: '/',
              expires: new Date(0)
            },
            {
              httpOnly: true,
              secure: false,
              sameSite: 'lax' as const,
              path: '/',
              maxAge: 0
            },
            {
              path: '/',
              expires: new Date(0)
            },
            {
              path: '/',
              maxAge: 0
            }
          ]

          overwriteOptions.forEach((options, index) => {
            res.cookie('jwt', '', options)
            this.logger.debug(`${ipType}アドレス経由 - パターン${index + 1}で強制上書き`)
          })
        }

        // localhost経由でのアクセスの場合のみlocalhost domainで削除
        if (hostHeader.includes('localhost')) {
          try {
            res.clearCookie('jwt', { ...cookieOptions, domain: 'localhost' })
            res.clearCookie('jwt', { path: '/', domain: 'localhost' })
            res.clearCookie('jwt', { httpOnly: true, path: '/', domain: 'localhost' })
            this.logger.debug('domain=localhostでクッキー削除試行')
          } catch (error) {
            this.logger.warn(`domain=localhostでのクッキー削除失敗: ${error}`)
          }
        }

        // .localhost ドメインでも試行（サブドメイン対応）
        if (hostHeader.includes('localhost')) {
          try {
            res.clearCookie('jwt', { ...cookieOptions, domain: '.localhost' })
            res.clearCookie('jwt', { path: '/', domain: '.localhost' })
            this.logger.debug('domain=.localhostでクッキー削除試行')
          } catch (error) {
            this.logger.warn(`domain=.localhostでのクッキー削除失敗: ${error}`)
          }
        }
      }

      // 追加的な削除方法（互換性のため）
      // 様々な設定パターンで削除を試行
      res.clearCookie('jwt', { path: '/' })
      res.clearCookie('jwt', { httpOnly: true, path: '/' })
      res.clearCookie('jwt', { secure: false, path: '/' })
      res.clearCookie('jwt', { httpOnly: true, secure: false, path: '/' })

      // ドメインを明示的に指定しない削除
      res.clearCookie('jwt', { ...cookieOptions, domain: undefined })

      // 本番環境でも念のため追加削除
      if (isProduction) {
        res.clearCookie('jwt', { httpOnly: true, secure: true, sameSite: 'strict', path: '/' })
        res.clearCookie('jwt', { httpOnly: true, secure: true, sameSite: 'none', path: '/' })
      }

      res.status(HttpStatus.OK).json({
        message: 'ログアウト成功'
      })
    } catch (error) {
      this.logger.error(`ログアウトエラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'ログアウトに失敗しました',
        error: error instanceof Error ? error.message : '不明なエラー'
      })
    }
  }

  /**
   * ユーザー情報取得エンドポイント
   * @param discordUserId DiscordユーザーID
   * @param res レスポンス
   */
  @Get(':userId/User')
  async getUser(@Param('userId') discordUserId: string, @Res() res: Response): Promise<void> {
    try {
      const userInfo = await this.userService.findOne(discordUserId)

      if (!userInfo) {
        throw new NotFoundException(`ユーザーID ${discordUserId} が見つかりません`)
      }

      res.status(HttpStatus.OK).json({
        message: 'userInfo',
        user: userInfo
      })
    } catch (error) {
      this.logger.error(`ユーザー情報取得エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)

      if (error instanceof NotFoundException) {
        res.status(HttpStatus.NOT_FOUND).json({ message: error.message })
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'ユーザー情報の取得に失敗しました',
          error: error instanceof Error ? error.message : '不明なエラー'
        })
      }
    }
  }

  /**
   * 認証されたユーザーのDiscordサーバー一覧を取得する
   * @param req リクエストオブジェクト（JwtAuthGuardによってユーザー情報が設定される）
   * @returns ユーザーが参加しているDiscordサーバー一覧
   */
  @Get('discord/guilds')
  @UseGuards(JwtAuthGuard)
  async getDiscordGuilds(@Req() req: RequestWithUser) {
    try {
      // JwtAuthGuardによって設定されたユーザー情報から取得
      const user = req.user as unknown as JwtTokenPayload
      const discordUserId = user.discordUserId

      this.logger.debug(`Discord Guild一覧取得リクエスト - ユーザー: ${discordUserId}`)

      // 実際にDBからアクセストークンを取得してGuild一覧を取得
      const guilds = await this.authService.getUserDiscordGuilds(discordUserId)

      this.logger.debug(`Discord Guild一覧取得成功: ${guilds.length}個のサーバー`)

      return {
        guilds,
        count: guilds.length,
        message: 'Discord Guild一覧を正常に取得しました'
      }
    } catch (error) {
      this.logger.error(`Discord Guild取得エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)

      // エラーに応じて適切なレスポンスを返す
      if (error instanceof Error && error.message.includes('アクセストークン')) {
        return {
          guilds: [],
          count: 0,
          message: 'アクセストークンが見つからないか期限切れです。再認証が必要です。',
          error: error.message
        }
      }

      throw error
    }
  }
}
