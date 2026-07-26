import { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import { throwError } from 'rxjs'
import request from 'supertest'
import { AppConfigService } from '../../config/config.service'
import { HttpExceptionFilter, ResponseInterceptor } from '../../core/http'
import { CookieService } from '../../core/http/cookie.service'
import { CryptoService } from '../../core/shared/services/crypto.service'
import { HttpClientService } from '../../core/shared/services/http.service'
import { User } from '../user/models/user.model'
import { UserService } from '../user/user.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { AuthService } from './services/auth.service'
import { JwtTokenService } from './token/jwt-token.service'

/**
 * AuthController の実 HTTP 経路を検証する。
 * 実 AuthService・JwtTokenService・guard・filter・interceptor を通し、Discord 外部 HTTP 境界だけをモックする。
 */
describe('AuthController HTTP integration', () => {
  const jwtSecret = 'auth-controller-http-spec-secret'
  const selfUserId = 'self-discord-id'
  const targetUserId = 'target-discord-id'
  const userService = {
    findOne: jest.fn()
  }
  const httpService = {
    post: jest.fn(),
    get: jest.fn()
  }
  const persistedUser: User = {
    discordUserId: selfUserId,
    name: 'Self User',
    avatarHash: 'self-avatar',
    characterIds: ['character-1'],
    discordAccessToken: 'secret-access-token',
    discordRefreshToken: 'secret-refresh-token',
    discordTokenExpiresAt: new Date('2026-07-26T00:00:00.000Z'),
    discordTokenScope: 'identify guilds'
  }

  let app: INestApplication
  let jwtService: JwtService

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: HttpClientService, useValue: httpService },
        {
          provide: CryptoService,
          useValue: {
            encrypt: jest.fn(),
            decrypt: jest.fn()
          }
        },
        {
          provide: AppConfigService,
          useValue: {
            get: (path: string) =>
              ({
                'app.environment': 'test',
                'app.frontendUrl': 'http://127.0.0.1:5173',
                'discord.applicationId': 'discord-app-id',
                'discord.secret': 'discord-client-secret'
              })[path]
          }
        },
        { provide: JwtService, useValue: new JwtService({ secret: jwtSecret }) },
        CookieService,
        JwtTokenService,
        JwtAuthGuard,
        HttpExceptionFilter,
        ResponseInterceptor
      ]
    }).compile()

    app = module.createNestApplication()
    app.use(cookieParser())
    await app.init()
    jwtService = module.get(JwtService)
  })

  beforeEach(() => {
    userService.findOne.mockReset()
    httpService.post.mockReset()
    httpService.get.mockReset()
  })

  afterAll(async () => {
    await app.close()
  })

  const signToken = (discordUserId: string): string =>
    jwtService.sign({
      username: `user-${discordUserId}`,
      discordUserId
    })

  const stripVolatile = (payload: Record<string, unknown>): Record<string, unknown> => {
    const { requestId, timestamp, ...rest } = payload
    return rest
  }

  it('JWT 欠落は実 guard/filter 経路で 401 を返す', async () => {
    const response = await request(app.getHttpServer()).get(`/auth/${selfUserId}/User`).expect(401)

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: '認証ヘッダーまたはクッキーが必要です'
      })
    )
  })

  it('無効 JWT は実 guard/filter 経路で 401 を返す', async () => {
    const response = await request(app.getHttpServer())
      .get(`/auth/${selfUserId}/User`)
      .set('Authorization', 'Bearer invalid-jwt')
      .expect(401)

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: '無効な認証トークンです'
      })
    )
  })

  it('/auth/validate-token は無効 JWT を実 service/filter 経路で 401 に分類する', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/validate-token')
      .set('Authorization', 'Bearer invalid-jwt')
      .expect(401)

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: 'トークンが無効です'
      })
    )
  })

  it('/auth/login は Discord が無効 code を 4xx で拒否した場合に 400 を返す', async () => {
    const discordClientError = Object.assign(new Error('Request failed with status code 400'), {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          error: 'invalid_grant',
          error_description: 'Invalid code'
        }
      }
    })
    httpService.post.mockReturnValueOnce(throwError(() => discordClientError))

    const response = await request(app.getHttpServer()).post('/auth/login').send({ code: 'invalid-code' }).expect(400)

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: '認証コードが無効または期限切れです'
      })
    )
    expect(httpService.post).toHaveBeenCalledTimes(1)
    expect(httpService.get).not.toHaveBeenCalled()
    expect(userService.findOne).not.toHaveBeenCalled()
  })

  it('別 secret で署名した形式の正しい JWT は実 guard/filter 経路で 401 を返す', async () => {
    const token = new JwtService({ secret: 'different-auth-controller-http-spec-secret' }).sign({
      username: `user-${selfUserId}`,
      discordUserId: selfUserId
    })

    const response = await request(app.getHttpServer())
      .get(`/auth/${selfUserId}/User`)
      .set('Authorization', `Bearer ${token}`)
      .expect(401)

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: '無効な認証トークンです'
      })
    )
    expect(userService.findOne).not.toHaveBeenCalled()
  })

  it('本人は 200 で公開4フィールドだけを受け取る', async () => {
    userService.findOne.mockResolvedValueOnce(persistedUser)

    const response = await request(app.getHttpServer())
      .get(`/auth/${selfUserId}/User`)
      .set('Authorization', `Bearer ${signToken(selfUserId)}`)
      .expect(200)

    expect(response.body.data.user).toEqual({
      discordUserId: selfUserId,
      name: persistedUser.name,
      avatarHash: persistedUser.avatarHash,
      characterIds: persistedUser.characterIds
    })
    expect(Object.keys(response.body.data.user).sort()).toEqual(['avatarHash', 'characterIds', 'discordUserId', 'name'])
  })

  it('cookie 由来 JWT は本人のユーザー情報を 200 で返す', async () => {
    userService.findOne.mockResolvedValueOnce(persistedUser)

    const response = await request(app.getHttpServer())
      .get(`/auth/${selfUserId}/User`)
      .set('Cookie', `jwt=${signToken(selfUserId)}`)
      .expect(200)

    expect(response.body.data.user.discordUserId).toBe(selfUserId)
    expect(userService.findOne).toHaveBeenCalledWith(selfUserId)
  })

  it('他人と本人対象不在は volatile 項目以外が同一の 404 になる', async () => {
    const otherResponse = await request(app.getHttpServer())
      .get(`/auth/${targetUserId}/User`)
      .set('Authorization', `Bearer ${signToken(selfUserId)}`)
      .expect(404)

    expect(userService.findOne).not.toHaveBeenCalled()

    userService.findOne.mockResolvedValueOnce(null)
    const missingResponse = await request(app.getHttpServer())
      .get(`/auth/${targetUserId}/User`)
      .set('Authorization', `Bearer ${signToken(targetUserId)}`)
      .expect(404)

    expect(userService.findOne).toHaveBeenCalledWith(targetUserId)
    expect(stripVolatile(otherResponse.body)).toEqual(stripVolatile(missingResponse.body))
  })
})
