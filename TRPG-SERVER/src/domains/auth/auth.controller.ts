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
        characterIds: []
      }

      await this.authService.signInAndRegisterUserInfo(user)
      const jwt = await this.authService.generateJwt(user)

      // セキュアクッキーにJWTを設定
      res.cookie('jwt', jwt, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
      })

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
  async login(@Body() loginDto: DiscordLoginDto, @Res() res: Response): Promise<void> {
    try {
      const { code } = loginDto

      if (!code) {
        throw new BadRequestException('認証コードが指定されていません')
      }

      const authData = await this.authService.authenticate(code)
      const userInfo = await this.authService.getUserInfo(authData.access_token)

      this.logger.debug(`User info: ${JSON.stringify(userInfo)}`)
      this.logger.debug(`Avatar hash from Discord: ${userInfo.avatar}`)

      const user: Partial<User> = {
        name: userInfo.username,
        discordUserId: userInfo.id,
        avatarHash: userInfo.avatar,
        characterIds: []
      }

      this.logger.debug(`User object to save: ${JSON.stringify(user)}`)

      await this.authService.signInAndRegisterUserInfo(user)
      const jwt = await this.authService.generateJwt(user)

      // セキュアクッキーにJWTを設定
      res.cookie('jwt', jwt, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })

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
  async logout(@Res() res: Response): Promise<void> {
    try {
      // JWTクッキーを削除
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/'
      })

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
}
