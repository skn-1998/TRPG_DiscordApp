import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UseFilters,
  HttpCode,
  HttpStatus,
  Headers,
  Param,
  Logger,
  BadRequestException
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request as ExpressRequest, Response } from 'express'
import { AuthService } from './services/auth.service'
import { UserService } from '../user/user.service'
import { User } from '../user/models/user.model'
import {
  DiscordLoginDto,
  ValidateTokenHeaderDto,
  TokenValidationOutputDto,
  GetUserParamDto
} from './dto/discord-login.dto'
import { DiscordUserProfile } from './models/discord-user.model'
import { CookieService } from '../../core/http/cookie.service'
import {
  ResponseInterceptor,
  HttpExceptionFilter,
  ApiErrorResponse,
  ApiError,
  SkipResponseWrapper
} from '../../core/http'
import { AppConfigService } from '../../config/config.service'

// Express型の拡張を使用（src/types/express/index.d.tsで定義）

/**
 * 認証コントローラー
 * 認証関連のエンドポイントを提供
 *
 * エラーハンドリングは HttpExceptionFilter（@UseFilters）、
 * 成功レスポンスの封筒化は ResponseInterceptor（@UseInterceptors）へ委譲する。
 * 各ハンドラはデータを return（成功）/ 例外を throw（異常）するだけにし、
 * status / message / error label は @HttpCode / @ResponseMessage / @ApiErrorResponse で宣言的に保持する。
 */
@Controller('auth')
@UseInterceptors(ResponseInterceptor)
@UseFilters(HttpExceptionFilter)
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly appConfigService: AppConfigService,
    private readonly cookieService: CookieService // DI追加
  ) {}

  /**
   * Discord認証リダイレクトエンドポイント
   */
  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  @SkipResponseWrapper()
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
  @SkipResponseWrapper()
  @ApiErrorResponse(401, 'Discord認証コールバックに失敗しました')
  async discordLoginCallback(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
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
    const isProduction = this.appConfigService.get('app.environment') === 'production'
    // クッキー設定をCookieServiceに委譲
    this.cookieService.setJwtCookie(res, jwt, isProduction)
    // フロントエンドページへリダイレクト
    const frontendUrl = this.appConfigService.get('app.frontendUrl') || '/'
    res.redirect(frontendUrl)
  }

  /**
   * トークン検証エンドポイント
   * @param headers Authorizationヘッダー
   * @returns JWTペイロード
   */
  @Get('validate-token')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponse(401, 'トークン検証に失敗しました')
  async validateToken(@Headers() headers: ValidateTokenHeaderDto): Promise<TokenValidationOutputDto> {
    const { Authorization } = headers
    const payload = await this.authService.validateToken(Authorization)
    // レスポンスDTOで型付け
    const output: TokenValidationOutputDto = {
      username: payload.username,
      discordUserId: payload.discordUserId,
      iat: payload.iat,
      exp: payload.exp
    }
    return output
  }

  /**
   * ログインエンドポイント
   * @param loginDto ログイン情報
   * @param res レスポンス
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponse(401, 'ログインに失敗しました')
  async login(
    @Body() loginDto: DiscordLoginDto,
    @Req() _req: ExpressRequest,
    @Res({ passthrough: true }) res: Response
  ): Promise<{
    message: string
    discordUserId: string | undefined
    userName: string | undefined
    token: string
    user: { id: string; username: string; avatar: string | undefined }
  }> {
    const { code } = loginDto
    if (!code) {
      throw new BadRequestException('認証コードが指定されていません')
    }
    const authData = await this.authService.authenticate(code)
    const userInfo = await this.authService.getUserInfo(authData.access_token)
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
    await this.authService.signInAndRegisterUserInfoWithTokens(user, authData)
    const jwt = await this.authService.generateJwt(user)
    const isProduction = this.appConfigService.get('app.environment') === 'production'
    // クッキー設定をCookieServiceに委譲（passthrough のためレスポンス本体は interceptor が封筒化）
    this.cookieService.setJwtCookie(res, jwt, isProduction)
    // 成功データを return → ResponseInterceptor が SuccessResponse でラップ
    return {
      message: '認証成功',
      discordUserId: user.discordUserId,
      userName: user.name,
      token: jwt,
      user: {
        id: user.discordUserId!,
        username: user.name!,
        avatar: user.avatarHash
      }
    }
  }

  /**
   * ログアウトエンドポイント
   * @param res レスポンス
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponse(500, 'ログアウトに失敗しました')
  async logout(@Req() _req: ExpressRequest, @Res({ passthrough: true }) res: Response): Promise<{ message: string }> {
    try {
      // クッキー削除をCookieServiceに委譲
      this.cookieService.clearJwtCookie(res)
      return { message: 'ログアウト成功' }
    } catch (error) {
      // 変換前同様、ログアウト失敗はログを残してから filter で 500 整形する
      this.logger.error(`ログアウトエラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      throw error
    }
  }

  /**
   * ユーザー情報取得エンドポイント
   * @param params userIdパラメータ
   */
  @Get(':userId/User')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponse(500, 'ユーザー情報の取得に失敗しました')
  async getUser(@Param() params: GetUserParamDto): Promise<{ user: User }> {
    const { userId } = params
    const userInfo = await this.userService.findOne(userId)
    if (!userInfo) {
      // 変換前: ApiResponseUtil.error(res, `ユーザーID ${userId} が見つかりません`, 404)
      // → status=404, label はデフォルト 'エラーが発生しました', error=渡した文字列
      throw new ApiError(404, 'エラーが発生しました', `ユーザーID ${userId} が見つかりません`)
    }
    return { user: userInfo }
  }
}
