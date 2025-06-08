import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom, lastValueFrom } from 'rxjs'
import { URLSearchParams } from 'url'
import { UserService } from '../../user/user.service'
import { User } from '../../user/models/user.model'
import { HttpClientService } from './http.service'
import { JwtTokenPayload } from '../models/auth.token.model'
import { DiscordAuthResponse, DiscordUserProfile } from '../models/discord-user.model'
import axios from 'axios'
import { AppConfigService } from 'src/config/config.service'

/**
 * 認証サービス
 * ユーザー認証と認可に関する機能を提供
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly jwtService: JwtService,
    private readonly httpService: HttpClientService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly appConfigService: AppConfigService
  ) {}

  /**
   * Discordユーザー情報を検証する
   * @param accessToken Discordアクセストークン
   * @param refreshToken Discordリフレッシュトークン
   * @param profile Discordプロファイル
   * @returns 検証済みユーザープロファイル
   */
  async validateDiscordUser(
    _accessToken: string,
    _refreshToken: string,
    profile: DiscordUserProfile
  ): Promise<DiscordUserProfile> {
    this.logger.debug(`Validating Discord user: ${profile.username}`)
    return profile
  }

  /**
   * 認証ヘッダーからJWTトークンを検証する
   * @param authorization 認証ヘッダー
   * @returns JWTトークンペイロード
   */
  async validateToken(authorization: string): Promise<JwtTokenPayload> {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('認証ヘッダーが無効または欠落しています')
    }

    const jwt = authorization.replace('Bearer ', '')

    try {
      return await this.parseJwt(jwt)
    } catch (error) {
      this.logger.error(`JWT検証エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      throw new UnauthorizedException('トークンが無効です')
    }
  }

  /**
   * ユーザー情報からJWTトークンを生成する
   * @param user ユーザー情報
   * @returns 生成されたJWTトークン
   */
  async generateJwt(user: User | Partial<User>): Promise<string> {
    if (!user.name || !user.discordUserId) {
      throw new Error('ユーザー名とDiscordユーザーIDは必須です')
    }

    const payload: JwtTokenPayload = {
      username: user.name,
      discordUserId: user.discordUserId
    }

    return this.jwtService.sign(payload)
  }

  /**
   * JWTトークンを解析する
   * @param token JWTトークン
   * @returns 解析されたトークンペイロード
   */
  async parseJwt(token: string): Promise<JwtTokenPayload> {
    try {
      const jwt = this.jwtService.verify<JwtTokenPayload>(token)
      this.logger.debug('JWT検証成功')
      return jwt
    } catch (error) {
      this.logger.error(`JWT検証エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      this.logger.error(`トークン: ${token}`)
      throw new UnauthorizedException('トークンが無効です')
    }
  }

  /**
   * ユーザー情報を登録またはログインする
   * @param user ユーザー情報
   */
  async signInAndRegisterUserInfo(user: Partial<User>): Promise<void> {
    this.logger.debug(`ユーザー登録/ログイン: ${user.discordUserId}`)

    if (!user.discordUserId) {
      throw new Error('DiscordユーザーIDが指定されていません')
    }

    try {
      const existingUser = await this.userService.findOne(user.discordUserId)

      if (!existingUser) {
        this.logger.log(`新規ユーザー作成: ${user.discordUserId}`)
        await this.userService.create({
          discordUserId: user.discordUserId,
          name: user.name,
          avatarHash: user.avatarHash
        })
      } else {
        // 既存ユーザーの場合、アバターハッシュを更新
        this.logger.log(`既存ユーザーのアバター更新: ${user.discordUserId}`)
        await this.userService.update(user.discordUserId, {
          name: user.name,
          avatarHash: user.avatarHash
        })
      }
    } catch (error) {
      this.logger.error(`ユーザー登録エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      throw error
    }
  }

  /**
   * Discordからユーザー情報を取得する
   * @param token Discordアクセストークン
   * @returns ユーザー情報
   */
  async getUserInfo(token: string): Promise<DiscordUserProfile> {
    const url = 'https://discordapp.com/api/users/@me'
    const headers = {
      Authorization: `Bearer ${token}`
    }

    try {
      const response = await firstValueFrom(this.httpService.get<DiscordUserProfile>(url, { headers }))

      this.logger.debug(`Discord user info response: ${JSON.stringify(response.data)}`)
      this.logger.debug(`Avatar hash: ${response.data.avatar}`)

      return response.data
    } catch (error) {
      this.logger.error(`Discordユーザー情報取得エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      throw new Error(
        `Discordユーザー情報の取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      )
    }
  }

  /**
   * Discordの認証コードを使用してトークンを取得する
   * @param code 認証コード
   * @returns Discord認証レスポンス
   */
  async authenticate(code: string): Promise<DiscordAuthResponse> {
    const url = 'https://discord.com/api/oauth2/token'
    const redirectUri = this.appConfigService.get('app.frontendUrl') + '/login'

    const params = new URLSearchParams()
    params.append('client_id', this.appConfigService.get('discord.applicationId'))
    params.append('client_secret', this.appConfigService.get('discord.secret'))
    params.append('grant_type', 'authorization_code')
    params.append('code', code)
    params.append('redirect_uri', redirectUri)

    this.logger.debug(`認証リクエスト: redirect_uri=${redirectUri}`)

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    }

    try {
      const response = await lastValueFrom(this.httpService.post<DiscordAuthResponse>(url, params, { headers }))

      this.logger.debug('Discord認証成功')
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`Discord認証エラー: ${error.message}, レスポンス: ${JSON.stringify(error.response.data)}`)
      } else {
        this.logger.error(`Discord認証エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      }
      throw new Error(`認証に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    }
  }
}
