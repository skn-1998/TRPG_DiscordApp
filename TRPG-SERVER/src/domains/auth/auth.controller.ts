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
  BadRequestException
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request as ExpressRequest, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './services/auth.service'
import { UserService } from '../user/user.service'
import { User } from '../user/models/user.model'
import { DiscordLoginDto } from './dto/discord-login.dto'
import { DiscordUserProfile } from './models/discord-user.model'
import { ErrorHandler } from '../../utils/error-handler'
import { CookieService } from '../../utils/cookie.service'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { ValidateTokenHeaderDto, TokenValidationOutputDto, GetUserParamDto } from './dto/discord-login.dto'

// Express型の拡張を使用（src/types/express/index.d.tsで定義）

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
    private readonly configService: ConfigService,
    private readonly cookieService: CookieService // DI追加
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
  async discordLoginCallback(@Req() req: ExpressRequest, @Res() res: Response): Promise<void> {
    try {
      const profile = req.user as unknown as DiscordUserProfile
      if (!profile) {
        throw new BadRequestException('プロファイル情報が取得できませんでした')
      }
      const user: Partial<User> = {
        name: profile.username,
        discordUserId: profile.id,
        avatarHash: profile.avatar,
        characterIds: [],
        discordAccessToken: '',
        discordRefreshToken: '',
        discordTokenExpiresAt: new Date(),
        discordTokenScope: ''
      }
      await this.authService.signInAndRegisterUserInfo(user)
      const jwt = await this.authService.generateJwt(user)
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production'
      // クッキー設定をCookieServiceに委譲
      this.cookieService.setJwtCookie(res, jwt, isProduction)
      // フロントエンドページへリダイレクト
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || '/'
      res.redirect(frontendUrl)
    } catch (error) {
      ApiResponseUtil.error(res, error, 401, 'Discord認証コールバックに失敗しました')
    }
  }

  /**
   * トークン検証エンドポイント
   * @param headers Authorizationヘッダー
   * @param res レスポンス
   * @returns JWTペイロード
   */
  @Get('validate-token')
  async validateToken(@Headers() headers: ValidateTokenHeaderDto, @Res() res: Response): Promise<void> {
    try {
      console.log('validateToken')
      const { Authorization } = headers
      console.log('Authorization', Authorization)
      console.log('headers', headers)
      const payload = await this.authService.validateToken(Authorization)
      // レスポンスDTOで型付け
      const output: TokenValidationOutputDto = {
        username: payload.username,
        discordUserId: payload.discordUserId,
        iat: payload.iat,
        exp: payload.exp
      }
      ApiResponseUtil.success(res, output, 'auth')
    } catch (error) {
      ApiResponseUtil.error(res, error, 401, 'トークン検証に失敗しました')
    }
  }

  /**
   * ログインエンドポイント
   * @param loginDto ログイン情報
   * @param res レスポンス
   */
  @Post('login')
  async login(@Body() loginDto: DiscordLoginDto, @Req() req: ExpressRequest, @Res() res: Response): Promise<void> {
    try {
      const { code } = loginDto
      if (!code) {
        throw new BadRequestException('認証コードが指定されていません')
      }
      console.log('login')
      const authData = await this.authService.authenticate(code)
      const userInfo = await this.authService.getUserInfo(authData.access_token)
      this.logger.debug(`User info: ${JSON.stringify(userInfo)}`)
      this.logger.debug(`Avatar hash from Discord: ${userInfo.avatar}`)
      const user: Partial<User> = {
        name: userInfo.username,
        discordUserId: userInfo.id,
        avatarHash: userInfo.avatar,
        characterIds: [],
        discordAccessToken: authData.access_token,
        discordRefreshToken: authData.refresh_token,
        discordTokenExpiresAt: new Date(Date.now() + authData.expires_in * 1000),
        discordTokenScope: authData.scope
      }
      this.logger.debug(`User object to save: ${JSON.stringify(user)}`)
      await this.authService.signInAndRegisterUserInfoWithTokens(user, authData)
      const jwt = await this.authService.generateJwt(user)
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production'
      // クッキー設定をCookieServiceに委譲
      this.cookieService.setJwtCookie(res, jwt, isProduction)
      // レスポンス生成をApiResponseUtilに委譲
      ApiResponseUtil.success(
        res,
        {
          message: '認証成功',
          discordUserId: user.discordUserId,
          userName: user.name,
          token: jwt,
          user: {
            id: user.discordUserId!,
            username: user.name!,
            avatar: user.avatarHash
          }
        },
        'auth'
      )
    } catch (error) {
      ApiResponseUtil.error(res, error, 401, 'ログインに失敗しました')
    }
  }

  /**
   * ログアウトエンドポイント
   * @param res レスポンス
   */
  @Post('logout')
  async logout(@Req() req: ExpressRequest, @Res() res: Response): Promise<void> {
    try {
      // クッキー削除をCookieServiceに委譲
      this.cookieService.clearJwtCookie(res)
      ApiResponseUtil.success(res, { message: 'ログアウト成功' }, 'auth')
    } catch (error) {
      this.logger.error(`ログアウトエラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      ApiResponseUtil.error(res, error, 500, 'ログアウトに失敗しました')
    }
  }

  /**
   * ユーザー情報取得エンドポイント
   * @param params userIdパラメータ
   * @param res レスポンス
   */
  @Get(':userId/User')
  async getUser(@Param() params: GetUserParamDto, @Res() res: Response): Promise<void> {
    try {
      const { userId } = params
      const userInfo = await this.userService.findOne(userId)
      if (!userInfo) {
        ApiResponseUtil.error(res, `ユーザーID ${userId} が見つかりません`, 404)
        return
      }
      ApiResponseUtil.success(res, { user: userInfo }, 'user')
    } catch (error) {
      ApiResponseUtil.error(res, error, 500, 'ユーザー情報の取得に失敗しました')
    }
  }
}
