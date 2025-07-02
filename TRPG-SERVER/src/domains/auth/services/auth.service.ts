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
import { CryptoUtil } from '../../../utils/crypto.util'

/**
 * Discord Guild（サーバー）情報
 */
export interface DiscordGuild {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
  features: string[]
}

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
      this.logger.error(`ユーザー登録エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
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
      const encryptedAccessToken = CryptoUtil.encrypt(authResponse.access_token)
      const encryptedRefreshToken = CryptoUtil.encrypt(authResponse.refresh_token)

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
      this.logger.error(`ユーザー登録エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
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
      return CryptoUtil.decrypt(user.discordAccessToken)
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
      const refreshToken = CryptoUtil.decrypt(user.discordRefreshToken)
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

      const response = await lastValueFrom(
        this.httpService.post<DiscordAuthResponse>(url, params.toString(), { headers })
      )
      const authData = response.data

      // 新しいトークンを暗号化して保存
      const tokenExpiresAt = new Date(Date.now() + authData.expires_in * 1000)
      const encryptedAccessToken = CryptoUtil.encrypt(authData.access_token)
      const encryptedRefreshToken = CryptoUtil.encrypt(authData.refresh_token)

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
   * ユーザーが参加しているDiscordサーバー一覧を取得する
   * @param discordUserId DiscordユーザーID
   * @returns ユーザーが参加しているサーバー一覧
   */
  async getUserDiscordGuilds(discordUserId: string): Promise<DiscordGuild[]> {
    try {
      this.logger.debug(`Discord Guild一覧取得開始: ${discordUserId}`)

      // DBからアクセストークンを取得
      const accessToken = await this.userService.getDiscordAccessToken(discordUserId)

      if (!accessToken) {
        this.logger.warn(`アクセストークンが見つからないか期限切れです: ${discordUserId}`)
        throw new Error('アクセストークンが見つからないか期限切れです。再認証が必要です。')
      }

      // アクセストークンを使ってGuild一覧を取得
      const guilds = await this.getDiscordGuildsWithToken(accessToken)

      this.logger.debug(`Discord Guild一覧取得成功: ${guilds.length}個のサーバー`)
      return guilds
    } catch (error) {
      this.logger.error(`Discord Guild取得エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
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
    this.logger.debug(`Client ID: ${applicationId}`)

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    }

    try {
      const response = await lastValueFrom(this.httpService.post<DiscordAuthResponse>(url, params, { headers }))

      this.logger.debug('Discord認証成功')
      this.logger.debug(`取得したスコープ: ${response.data.scope}`)
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

  /**
   * Discordアクセストークンを使用してユーザーのサーバー一覧を取得する
   * @param accessToken Discordアクセストークン
   * @returns ユーザーが参加しているサーバー一覧
   */
  async getDiscordGuildsWithToken(accessToken: string): Promise<DiscordGuild[]> {
    const url = 'https://discord.com/api/users/@me/guilds'
    const headers = {
      Authorization: `Bearer ${accessToken}`
    }

    try {
      const response = await firstValueFrom(this.httpService.get<DiscordGuild[]>(url, { headers }))

      this.logger.debug(`Discord Guild一覧取得成功: ${response.data.length}個のサーバー`)
      return response.data
    } catch (error) {
      this.logger.error(`Discord Guild取得エラー: ${error instanceof Error ? error.message : '不明なエラー'}`)
      throw new Error(
        `Discordサーバー一覧の取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      )
    }
  }
}
