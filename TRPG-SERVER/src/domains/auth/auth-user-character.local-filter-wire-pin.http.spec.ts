import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import { Request } from 'express'
import request from 'supertest'
import { AppConfigService } from '../../config/config.service'
import { HttpExceptionFilter, ResponseInterceptor } from '../../core/http'
import { CookieService } from '../../core/http/cookie.service'
import { APP_VALIDATION_PIPE_OPTIONS } from '../../core/http/validation-pipe.provider'
import { CryptoService } from '../../core/shared/services/crypto.service'
import { HttpClientService } from '../../core/shared/services/http.service'
import { CharacterController } from '../character/character.controller'
import { CharacterService } from '../character/character.service'
import { UserController } from '../user/user.controller'
import { UserService } from '../user/user.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { AuthService } from './services/auth.service'
import { JwtTokenService } from './token/jwt-token.service'

/**
 * auth / user / character controller に残る局所 filter の現行 wire 封筒を固定する。
 * APP_FILTER は登録せず、実 HTTP route と controller の @UseFilters を通す。
 */
describe('Auth / User / Character local filter wire pins', () => {
  const authenticatedUser = {
    username: 'local-filter-wire-user',
    discordUserId: 'local-filter-wire-user-id'
  }
  const userService = {
    findByDiscordId: jest.fn()
  }
  const characterService = {
    findOneForOwner: jest.fn()
  }

  let app: INestApplication

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, UserController, CharacterController],
      providers: [
        AuthService,
        JwtTokenService,
        { provide: JwtService, useValue: new JwtService({ secret: 'local-filter-wire-secret' }) },
        { provide: UserService, useValue: userService },
        { provide: CharacterService, useValue: characterService },
        {
          provide: HttpClientService,
          useValue: {
            post: jest.fn(),
            get: jest.fn()
          }
        },
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
            get: jest.fn((path: string) => (path === 'app.environment' ? 'test' : undefined))
          }
        },
        CookieService,
        HttpExceptionFilter,
        ResponseInterceptor
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<Request>()
          req.user = authenticatedUser
          return true
        }
      })
      .compile()

    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe(APP_VALIDATION_PIPE_OPTIONS))
    await app.init()
  })

  beforeEach(() => {
    userService.findByDiscordId.mockReset()
    characterService.findOneForOwner.mockReset()
  })

  afterAll(async () => {
    await app.close()
  })

  // E1b-2 の wire 拡張を diff で宣言するため、局所 filter 配下の before 封筒を固定する。
  it('POST /auth/login の ValidationPipe 400 は複数診断を details なしで返す', async () => {
    const response = await request(app.getHttpServer()).post('/auth/login').send({}).expect(400)

    expect(response.body).toStrictEqual({
      success: false,
      message: 'エラーが発生しました',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: '認証コードは必須です, 認証コードは必須です'
    })
  })

  // E1b-2 の wire 拡張を diff で宣言するため、局所 filter 配下の before 封筒を固定する。
  it('GET /auth/validate-token の JWT 検証失敗は 401 封筒を返す', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/validate-token')
      .set('Authorization', 'Bearer invalid-jwt')
      .expect(401)

    expect(response.body).toStrictEqual({
      success: false,
      message: 'エラーが発生しました',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: 'トークンが無効です'
    })
  })

  // E1b-2 の wire 拡張を diff で宣言するため、局所 filter 配下の before 封筒を固定する。
  it('GET /character/:id の不在は ApiError フィールドを含む 404 封筒を返す', async () => {
    characterService.findOneForOwner.mockResolvedValueOnce(null)

    const response = await request(app.getHttpServer()).get('/character/missing-character').expect(404)

    expect(response.body).toStrictEqual({
      success: false,
      message: '未発見エラー',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: 'キャラクターが見つかりません',
      errorCode: 'NOT_FOUND_ERROR'
    })
  })

  // E1b-2 の wire 拡張を diff で宣言するため、局所 filter 配下の before 封筒を固定する。
  it('GET /users の不在は 404 封筒を返す', async () => {
    userService.findByDiscordId.mockResolvedValueOnce(null)

    const response = await request(app.getHttpServer()).get('/users').expect(404)

    expect(response.body).toStrictEqual({
      success: false,
      message: 'エラーが発生しました',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: 'ユーザーが見つかりません'
    })
  })
})
