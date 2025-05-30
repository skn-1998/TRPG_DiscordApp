import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { firstValueFrom, lastValueFrom } from 'rxjs'
import { URLSearchParams } from 'url'

import { UserService } from 'src/domains/user/user.service'
import { User } from 'src/domains/user/models/user.model'
import _ from 'lodash'
import { JWTTokenModel } from './auth.token.model'
import { CustomHttpService } from './http.service'
import { getErrorMessage } from 'src/utils/error-helpers'
import { AppConfigService } from 'src/config/config.service'

@Injectable()
export class AuthService {
  // eslint-disable-next-line no-unused-vars
  constructor(
    private readonly jwtService: JwtService,
    private readonly httpService: CustomHttpService,
    readonly userService: UserService,
    private readonly configService: AppConfigService
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async validateUser(accessToken: string, refreshToken: string, profile: any): Promise<any> {
    return profile
  }

  async validateToken(authorization: string): Promise<JWTTokenModel> {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid or missing Authorization header')
    }
    const jwt = authorization.replace('Bearer ', '')
    try {
      // トークンの検証と解析
      const token = await this.parseJwt(jwt)
      return token
    } catch (error) {
      throw getErrorMessage(error)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generateJwt(user: Partial<User>): Promise<string> {
    if (!user.name || !user.discordUserId) {
      throw new Error('ユーザー名とDiscordユーザーIDは必須です')
    }
    const payload: JWTTokenModel = { username: user.name, discordUserId: user.discordUserId }
    return this.jwtService.sign(payload)
  }

  async parseJwt(token: string): Promise<JWTTokenModel> {
    try {
      const jwt = this.jwtService.verify<JWTTokenModel>(token)
      console.log('jwt: ', jwt)
      return jwt
    } catch (error) {
      throw getErrorMessage(error)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signInAndRegisterUserInfo(user: Partial<User>): Promise<any> {
    //ユーザーID検証
    // 1.User.discordUserIdで情報検索
    // 2.存在しない場合 新しく登録
    // 3.存在する場合スキップ
    console.log(user)
    if (_.isNull(user.discordUserId) || _.isUndefined(user.discordUserId)) {
      console.log('discordId is Null')
    }

    try {
      const userInfo = await this.userService.findOne(user.discordUserId)

      if (_.isNil(userInfo) && user.name && user.discordUserId) {
        console.log('ユーザー作成')
        const createUserDto = {
          name: user.name,
          discordUserId: user.discordUserId,
          characterIds: []
        }
        const userData = await this.userService.create(createUserDto)
        console.log(userData)
      }
    } catch (error) {
      throw getErrorMessage(error)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getUserInfo(token: string): Promise<any> {
    const url = 'https://discordapp.com/api/users/@me'
    const headers = {
      Authorization: `Bearer ${token}`
    }
    const res = await firstValueFrom(this.httpService.get(url, { headers }))
    return res.data
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async authenticate(code: string): Promise<any> {
    const url = 'https://discordapp.com/api/oauth2/token'
    const params = new URLSearchParams()
    const redirectUrl = this.configService.get('auth.redirectUrl')

    console.log(
      process.env.DISCORD_APPLICATIONID + ':' + process.env.DISCORD_SECRET + code + 'authorization_code' + redirectUrl
    )
    params.append('client_id', process.env.DISCORD_APPLICATIONID)
    params.append('client_secret', process.env.DISCORD_SECRET)
    params.append('grant_type', 'authorization_code')
    params.append('code', code)
    params.append('redirect_uri', redirectUrl)

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
    try {
      const res = await lastValueFrom(this.httpService.post(url, params, { headers }))
      console.log(res.data)
      return res.data
    } catch (error) {
      console.log(error)
      throw new Error(`Failed to authenticate: ${error}`)
    }
  }
}
