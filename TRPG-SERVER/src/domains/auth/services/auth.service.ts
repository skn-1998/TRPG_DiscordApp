import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { firstValueFrom, lastValueFrom } from 'rxjs'
import { URLSearchParams } from 'url'
import { AxiosResponse } from 'axios'
import { UserService } from '../../user/user.service'
import { User } from '../../user/models/user.model'
import { HttpClientService } from '../../../core/shared/services/http.service'
import { JwtTokenPayload } from '../models/auth.token.model'
import { JwtTokenService } from '../token/jwt-token.service'
import { DiscordAuthResponse, DiscordUserProfile } from '../models/discord-user.model'
import axios from 'axios'
import { AppConfigService } from 'src/config/config.service'
import { CryptoService } from '../../../core/shared/services/crypto.service'
import { ErrorHandler } from '../../../core/http/error-handler'

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
    private readonly appConfigService: AppConfigService,
    private readonly cryptoService: CryptoService,
    private readonly jwtTokenService: JwtTokenService
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
    // JWT 検証プリミティブは JwtTokenService に集約済み（循環解消のため）。
    // 挙動（検証ロジック・例外・戻り値）は不変。
    return this.jwtTokenService.validateToken(authorization)
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
    // JWT 検証プリミティブは JwtTokenService に集約済み（循環解消のため）。挙動は不変。
    return this.jwtTokenService.parseJwt(token)
  }

  /**
   * ユーザー情報を登録またはログインする（従来互換）
   * @param user ユーザー情報
   * @deprecated signInAndRegisterUserInfoWithTokensを使用してください
   */
  async signInAndRegisterUserInfo(user: Partial<User>): Promise<void> {
    this.logger.debug(`ユーザー登録/ログイン（従来互換）: ${user.discordUserId}`)

    if (!user.discordUserId) {
      throw new Error('DiscordユーザーIDが指定されていません')
    }

    try {
      const existingUser = await this.userService.findOne(user.discordUserId)

      if (!existingUser) {
        this.logger.log(`新規ユーザー作成（従来互換）: ${user.discordUserId}`)
        await this.userService.create({
          discordUserId: user.discordUserId,
          name: user.name || 'Unknown User',
          avatarHash: user.avatarHash,
          characterIds: user.characterIds || []
        })
      } else {
        this.logger.log(`既存ユーザーのアバター更新（従来互換）: ${user.discordUserId}`)
        await this.userService.update(user.discordUserId, {
          name: user.name,
          avatarHash: user.avatarHash
        })
      }
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          action: 'sign-in-register-user-info',
          discordUserId: user.discordUserId
        },
        'AuthService'
      )

      // ErrorHandler.handleServiceError は Error をスローするため、ここには到達しない
      throw error
    }
  }

  /**
   * ユーザー情報を登録またはログインし、Discordトークンを暗号化して保存する
   * @param user ユーザー情報
   * @param authResponse Discord認証レスポンス
   */
  async signInAndRegisterUserInfoWithTokens(user: Partial<User>, authResponse: DiscordAuthResponse): Promise<void> {
    this.logger.debug(`ユーザー登録/ログイン（トークン付き）: ${user.discordUserId}`)

    if (!user.discordUserId) {
      throw new Error('DiscordユーザーIDが指定されていません')
    }

    try {
      const existingUser = await this.userService.findOne(user.discordUserId)
      const tokenExpiresAt = new Date(Date.now() + authResponse.expires_in * 1000)

      // トークンを暗号化
      const encryptedAccessToken = this.cryptoService.encrypt(authResponse.access_token)
      const encryptedRefreshToken = this.cryptoService.encrypt(authResponse.refresh_token)

      const userData = {
        discordUserId: user.discordUserId,
        name: user.name || 'Unknown User',
        avatarHash: user.avatarHash,
        discordAccessToken: encryptedAccessToken,
        discordRefreshToken: encryptedRefreshToken,
        discordTokenExpiresAt: tokenExpiresAt,
        discordTokenScope: authResponse.scope
      }

      if (!existingUser) {
        this.logger.log(`新規ユーザー作成（トークン付き）: ${user.discordUserId}`)
        await this.userService.create(userData)
      } else {
        this.logger.log(`既存ユーザーの情報・トークン更新: ${user.discordUserId}`)
        await this.userService.update(user.discordUserId, userData)
      }
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          action: 'sign-in-register-user-info-with-tokens',
          discordUserId: user.discordUserId
        },
        'AuthService'
      )

      // ErrorHandler.handleServiceError は Error をスローするため、ここには到達しない
      throw error
    }
  }

  /**
   * ユーザーの有効なDiscordアクセストークンを取得（自動更新付き）
   * @param discordUserId DiscordユーザーID
   * @returns 有効なアクセストークン
   */
  async getValidDiscordAccessToken(discordUserId: string): Promise<string> {
    const user = await this.userService.findOne(discordUserId)
    if (!user || !user.discordAccessToken) {
      throw new UnauthorizedException('Discordトークンが見つかりません')
    }

    // トークンの有効期限をチェック
    const now = new Date()
    const expiresAt = user.discordTokenExpiresAt

    if (!expiresAt || now >= expiresAt) {
      this.logger.log(`トークン期限切れ、自動更新開始: ${discordUserId}`)
      return await this.refreshDiscordToken(discordUserId)
    }

    // 有効なトークンを復号化して返す
    try {
      return this.cryptoService.decrypt(user.discordAccessToken)
    } catch (error) {
      this.logger.error(`トークン復号化エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      throw new UnauthorizedException('トークンの復号化に失敗しました')
    }
  }

  /**
   * Discordトークンを自動更新する
   * @param discordUserId DiscordユーザーID
   * @returns 新しいアクセストークン
   */
  private async refreshDiscordToken(discordUserId: string): Promise<string> {
    const user = await this.userService.findOne(discordUserId)
    if (!user || !user.discordRefreshToken) {
      throw new UnauthorizedException('リフレッシュトークンが見つかりません')
    }

    try {
      const refreshToken = this.cryptoService.decrypt(user.discordRefreshToken)
      const url = 'https://discord.com/api/oauth2/token'
      const applicationId = this.appConfigService.get('discord.applicationId')
      const clientSecret = this.appConfigService.get('discord.secret')

      const params = new URLSearchParams()
      params.append('client_id', applicationId)
      params.append('client_secret', clientSecret)
      params.append('grant_type', 'refresh_token')
      params.append('refresh_token', refreshToken)

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      }

      const response: AxiosResponse<DiscordAuthResponse> = await lastValueFrom(
        this.httpService.post<DiscordAuthResponse>(url, params.toString(), { headers })
      )
      const authData = response.data

      // 新しいトークンを暗号化して保存
      const tokenExpiresAt = new Date(Date.now() + authData.expires_in * 1000)
      const encryptedAccessToken = this.cryptoService.encrypt(authData.access_token)
      const encryptedRefreshToken = this.cryptoService.encrypt(authData.refresh_token)

      await this.userService.update(discordUserId, {
        discordAccessToken: encryptedAccessToken,
        discordRefreshToken: encryptedRefreshToken,
        discordTokenExpiresAt: tokenExpiresAt,
        discordTokenScope: authData.scope
      })

      this.logger.log(`トークン自動更新完了: ${discordUserId}`)
      return authData.access_token
    } catch (error) {
      this.logger.error(`トークン更新エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      throw new UnauthorizedException('トークンの更新に失敗しました')
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
      const response: AxiosResponse<DiscordUserProfile> = await firstValueFrom(
        this.httpService.get<DiscordUserProfile>(url, { headers })
      )
      const userData = response.data

      return userData
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
    const applicationId = this.appConfigService.get('discord.applicationId')
    const clientSecret = this.appConfigService.get('discord.secret')
    const params = new URLSearchParams()
    params.append('client_id', applicationId)
    params.append('client_secret', clientSecret)
    params.append('grant_type', 'authorization_code')
    params.append('code', code)
    params.append('redirect_uri', redirectUri)
    params.append('scope', 'identify email guilds')

    this.logger.debug(`認証リクエスト: redirect_uri=${redirectUri}`)
    this.logger.debug(`認証スコープ: identify email guilds`)

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    }

    try {
      const response: AxiosResponse<DiscordAuthResponse> = await lastValueFrom(
        this.httpService.post<DiscordAuthResponse>(url, params, { headers })
      )
      const authData = response.data
      this.logger.debug('Discord認証成功')
      this.logger.debug(`取得したスコープ: ${authData.scope}`)
      return authData
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`Discord認証エラー: ${error.message}, レスポンス: ${JSON.stringify(error.response.data)}`)
        const status = error.response.status
        const isDiscordClientError = status >= 400 && status < 500
        if (isDiscordClientError) {
          throw new BadRequestException('認証コードが無効または期限切れです')
        }
      } else {
        this.logger.error(`Discord認証エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      }

      ErrorHandler.handleServiceError(
        error,
        {
          action: 'discord-oauth-code-exchange',
          additionalData: { hasCode: !!code }
        },
        'AuthService'
      )

      // ErrorHandler.handleServiceError は Error をスローするため、ここには到達しない
      throw error
    }
  }
}
