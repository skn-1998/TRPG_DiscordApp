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
import { UserController } from '../user/user.controller'
import { UserService } from '../user/user.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { AuthService } from './services/auth.service'
import { JwtTokenService } from './token/jwt-token.service'

/**
 * 認証関連の実 HTTP 経路を検証する。
 * 実 AuthService・JwtTokenService・guard・filter・interceptor を通し、Discord 外部 HTTP 境界だけをモックする。
 */
describe('AuthController HTTP integration', () => {
  const jwtSecret = 'auth-controller-http-spec-secret'
  const userService = {
    findOne: jest.fn()
  }
  const httpService = {
    post: jest.fn(),
    get: jest.fn()
  }

  let app: INestApplication

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, UserController],
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
  })

  beforeEach(() => {
    userService.findOne.mockReset()
    httpService.post.mockReset()
    httpService.get.mockReset()
  })

  afterAll(async () => {
    await app.close()
  })

  it('/users は JWT 欠落を実 guard/filter 経路で 401 にする', async () => {
    const response = await request(app.getHttpServer()).get('/users').expect(401)

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: '認証ヘッダーまたはクッキーが必要です'
      })
    )
    expect(userService.findOne).not.toHaveBeenCalled()
  })

  it('/users は別 secret で署名した JWT を実 guard/filter 経路で 401 にする', async () => {
    const token = new JwtService({ secret: 'different-auth-controller-http-spec-secret' }).sign({
      username: 'different-secret-user',
      discordUserId: 'different-secret-user-id'
    })

    const response = await request(app.getHttpServer())
      .get('/users')
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
})
