import { Test, TestingModule } from '@nestjs/testing'
import { Response } from 'express'
import request from 'supertest'
import {
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  ExecutionContext,
  CallHandler,
  ArgumentsHost
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { lastValueFrom, of } from 'rxjs'
import { APP_VALIDATION_PIPE_PROVIDER } from '../../core/http/validation-pipe.provider'
import { AuthController } from './auth.controller'
import { AuthService } from './services/auth.service'
import { DiscordLoginDto } from './dto/discord-login.dto'
import { DiscordUserProfile } from './models/discord-user.model'
import { JwtTokenPayload } from './models/auth.token.model'
import { CookieService } from '../../core/http/cookie.service'
import { ResponseInterceptor, HttpExceptionFilter, RESPONSE_MESSAGE_KEY } from '../../core/http'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { AppConfigService } from '../../config/config.service'

describe('AuthController', () => {
  let controller: AuthController
  let authService: jest.Mocked<AuthService>
  const configValues: Record<string, string> = {
    'app.environment': 'development',
    'app.frontendUrl': 'http://localhost:3000'
  }

  const mockDiscordProfile: DiscordUserProfile = {
    id: 'test-discord-id',
    username: 'TestUser',
    discriminator: '0001',
    avatar: 'test-avatar-hash',
    verified: true,
    email: 'test@example.com'
  }

  const mockJwtPayload: JwtTokenPayload = {
    username: 'Test User',
    discordUserId: 'test-discord-id'
  }

  const mockAuthData = {
    access_token: 'test-access-token',
    token_type: 'Bearer',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    scope: 'identify guilds'
  }

  const mockRequest = () =>
    ({
      user: mockDiscordProfile,
      query: { state: 'test-state' },
      get: jest.fn().mockReturnValue('localhost:3000'),
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' }
    }) as any

  const mockResponse = () =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }) as any

  // ===== 変換後方式（戻り値 + throw）を envelope へ変換して検証するヘルパ =====
  // 変換前: ハンドラ内で ApiResponseUtil.success/error を直接呼んでいた。
  // 変換後: ハンドラはデータを return / 例外を throw し、
  //         ResponseInterceptor / HttpExceptionFilter が封筒化する。
  // 以下のヘルパは「実運用と同じ interceptor/filter」を介して最終 envelope を再現し、
  // 変換前の spec が保証していた envelope/status/message を引き続き検証する。

  const reflector = new Reflector()

  /** メソッド名から @ResponseMessage メタを実機同様に読む */
  const readMessage = (method: keyof AuthController): string =>
    reflector.get<string>(RESPONSE_MESSAGE_KEY, controller[method] as any) ?? '成功'

  /** ハンドラの戻り値を ResponseInterceptor に通して最終 envelope を得る */
  const wrapSuccess = async (method: keyof AuthController, data: unknown): Promise<any> => {
    const interceptor = new ResponseInterceptor(reflector)
    const ctx = { getHandler: () => controller[method] } as unknown as ExecutionContext
    const next: CallHandler = { handle: () => of(data) }
    return lastValueFrom(interceptor.intercept(ctx, next))
  }

  /** ハンドラから throw された例外を HttpExceptionFilter に通して最終 envelope/status を得る */
  const filterError = (error: unknown): { status: number; body: any } => {
    // P1-C: filter は AppConfigService から dev 判定（includeStack）を得る。
    // test 環境想定で非 development を返す＝stack 非含有（ApiResponseUtil.error の既定と一致）。
    const mockAppConfig = {
      get: (path: string) => (path === 'app.environment' ? 'test' : undefined)
    } as unknown as import('../../config/config.service').AppConfigService
    const filter = new HttpExceptionFilter(reflector, mockAppConfig)
    const captured: { status?: number; body?: any } = {}
    const res = {
      status: (s: number) => {
        captured.status = s
        return res
      },
      json: (b: any) => {
        captured.body = b
        return res
      }
    } as unknown as Response
    const host = {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }),
      getHandler: () => null
    } as unknown as ArgumentsHost
    filter.catch(error, host)
    return { status: captured.status!, body: captured.body }
  }

  const stripVolatile = (payload: any): Record<string, unknown> => {
    const { requestId, timestamp, ...rest } = payload
    return rest
  }

  beforeEach(async () => {
    const authServiceMock = {
      validateToken: jest.fn(),
      generateJwt: jest.fn(),
      signInAndRegisterUserInfo: jest.fn(),
      signInAndRegisterUserInfoWithTokens: jest.fn(),
      authenticate: jest.fn(),
      getUserInfo: jest.fn()
    }

    configValues['app.environment'] = 'development'
    configValues['app.frontendUrl'] = 'http://localhost:3000'

    const appConfigServiceMock = {
      get: jest.fn((key: string) => configValues[key])
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: AppConfigService, useValue: appConfigServiceMock },
        // CookieService は res を操作するだけの副作用境界。外部依存が無いため
        // モックせず実体を登録し、res.cookie / res.clearCookie の呼び出しを検証する。
        CookieService
      ]
    }).compile()

    controller = module.get<AuthController>(AuthController)
    authService = module.get(AuthService)
  })

  describe('基本機能', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
    })

    it('should have all required methods', () => {
      expect(controller.discordLogin).toBeDefined()
      expect(controller.discordLoginCallback).toBeDefined()
      expect(controller.validateToken).toBeDefined()
      expect(controller.login).toBeDefined()
      expect(controller.logout).toBeDefined()
    })
  })

  describe('GET /auth/discord', () => {
    it('should redirect to Discord authentication', async () => {
      await expect(controller.discordLogin()).resolves.toBeUndefined()
    })
  })

  describe('GET /auth/discord/callback', () => {
    it('should handle Discord authentication callback successfully', async () => {
      const req = mockRequest()
      const res = mockResponse()

      configValues['app.environment'] = 'development'
      authService.signInAndRegisterUserInfo.mockResolvedValue(undefined)
      authService.generateJwt.mockResolvedValue('test-jwt-token')

      await controller.discordLoginCallback(req, res)

      expect(authService.signInAndRegisterUserInfo).toHaveBeenCalled()
      expect(authService.generateJwt).toHaveBeenCalled()
      expect(res.cookie).toHaveBeenCalledWith('jwt', 'test-jwt-token', expect.any(Object))
      expect(res.redirect).toHaveBeenCalled()
    })

    it('should throw on missing profile; filter preserves BadRequestException as 400', async () => {
      const req = { ...mockRequest(), user: null }
      const res = mockResponse()

      // 変換後: profile 不在は例外を throw（filter が 400 整形）。res は触らない。
      await expect(controller.discordLoginCallback(req, res)).rejects.toBeInstanceOf(BadRequestException)
      expect(res.cookie).not.toHaveBeenCalled()
      expect(res.redirect).not.toHaveBeenCalled()

      let thrown: unknown
      try {
        await controller.discordLoginCallback(req, res)
      } catch (e) {
        thrown = e
      }
      const { status, body } = filterError(thrown)
      expect(status).toBe(400)
      expect(body).toEqual(
        expect.objectContaining({
          success: false,
          message: 'エラーが発生しました',
          error: 'プロファイル情報が取得できませんでした'
        })
      )
    })

    it('should handle production environment cookie settings', async () => {
      const req = mockRequest()
      const res = mockResponse()

      configValues['app.environment'] = 'production'
      authService.signInAndRegisterUserInfo.mockResolvedValue(undefined)
      authService.generateJwt.mockResolvedValue('test-jwt-token')

      await controller.discordLoginCallback(req, res)

      expect(res.cookie).toHaveBeenCalledWith(
        'jwt',
        'test-jwt-token',
        expect.objectContaining({ secure: true, sameSite: 'none' })
      )
    })
  })

  describe('GET /auth/validate-token', () => {
    it('returns payload, wrapped envelope equals ApiResponseUtil.success (200/成功)', async () => {
      authService.validateToken.mockResolvedValue(mockJwtPayload)

      const output = await controller.validateToken('Bearer valid-token')

      expect(authService.validateToken).toHaveBeenCalledWith('Bearer valid-token')
      expect(output).toEqual(
        expect.objectContaining({
          username: mockJwtPayload.username,
          discordUserId: mockJwtPayload.discordUserId
        })
      )

      // interceptor を通した envelope が変換前(ApiResponseUtil.success)と一致
      const envelope = await wrapSuccess('validateToken', output)
      expect(envelope).toEqual(
        expect.objectContaining({
          success: true,
          message: '成功',
          data: expect.objectContaining({ username: mockJwtPayload.username })
        })
      )
      expect(readMessage('validateToken')).toBe('成功')
    })

    it('preserves invalid-token UnauthorizedException as 401', async () => {
      const err = new UnauthorizedException('トークンが無効です')
      authService.validateToken.mockRejectedValue(err)

      await expect(controller.validateToken('Bearer invalid-token')).rejects.toBe(err)

      const { status, body } = filterError(err)
      expect(status).toBe(401)
      expect(body).toEqual(expect.objectContaining({ message: 'エラーが発生しました', error: 'トークンが無効です' }))

      const ref = mockResponse()
      ApiResponseUtil.error(ref, err, 401)
      expect(stripVolatile(body)).toEqual(stripVolatile(ref.json.mock.calls[0][0]))
    })

    it('delegates missing authorization header to AuthService for 401 classification', async () => {
      const err = new UnauthorizedException('認証ヘッダーが無効または欠落しています')
      authService.validateToken.mockRejectedValue(err)

      await expect(controller.validateToken(undefined)).rejects.toBe(err)
      expect(authService.validateToken).toHaveBeenCalledWith('')
      expect(filterError(err).status).toBe(401)
    })
  })

  describe('POST /auth/login', () => {
    it('DiscordLoginDto の code 必須欠落を pipe で handler 実行前に 400 にする', async () => {
      const httpModule = await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          { provide: AuthService, useValue: authService },
          {
            provide: AppConfigService,
            useValue: { get: jest.fn((key: string) => configValues[key]) }
          },
          CookieService,
          HttpExceptionFilter,
          ResponseInterceptor,
          APP_VALIDATION_PIPE_PROVIDER
        ]
      }).compile()
      const app = httpModule.createNestApplication()
      await app.init()

      try {
        const response = await request(app.getHttpServer()).post('/auth/login').send({}).expect(HttpStatus.BAD_REQUEST)

        expect(response.body.error).toContain('認証コードは必須です')
        expect(response.body.error).not.toBe('認証コードが指定されていません')
        expect(authService.authenticate).not.toHaveBeenCalled()
      } finally {
        await app.close()
      }
    })

    it('logs in with valid Discord code; envelope equals ApiResponseUtil.success', async () => {
      const loginDto: DiscordLoginDto = { code: 'valid-discord-code' }
      const req = mockRequest()
      const res = mockResponse()

      configValues['app.environment'] = 'development'
      authService.authenticate.mockResolvedValue(mockAuthData)
      authService.getUserInfo.mockResolvedValue(mockDiscordProfile)
      authService.signInAndRegisterUserInfoWithTokens.mockResolvedValue(undefined)
      authService.generateJwt.mockResolvedValue('test-jwt-token')

      const data = await controller.login(loginDto, req, res)

      expect(authService.authenticate).toHaveBeenCalledWith('valid-discord-code')
      expect(authService.getUserInfo).toHaveBeenCalledWith('test-access-token')
      expect(authService.signInAndRegisterUserInfoWithTokens).toHaveBeenCalled()
      expect(authService.generateJwt).toHaveBeenCalled()
      expect(res.cookie).toHaveBeenCalledWith('jwt', 'test-jwt-token', expect.any(Object))

      const envelope = await wrapSuccess('login', data)
      expect(envelope).toEqual(
        expect.objectContaining({
          success: true,
          message: '成功',
          data: expect.objectContaining({
            message: '認証成功',
            discordUserId: mockDiscordProfile.id,
            userName: mockDiscordProfile.username,
            token: 'test-jwt-token',
            user: expect.objectContaining({
              id: mockDiscordProfile.id,
              username: mockDiscordProfile.username,
              avatar: mockDiscordProfile.avatar
            })
          })
        })
      )
    })

    it('handles missing Discord code (throws, authenticate not called)', async () => {
      const loginDto: DiscordLoginDto = { code: '' }
      const req = mockRequest()
      const res = mockResponse()

      await expect(controller.login(loginDto, req, res)).rejects.toBeInstanceOf(BadRequestException)
      expect(authService.authenticate).not.toHaveBeenCalled()
    })

    it('preserves invalid-code BadRequestException as 400', async () => {
      const loginDto: DiscordLoginDto = { code: 'invalid-code' }
      const req = mockRequest()
      const res = mockResponse()
      const err = new BadRequestException('認証コードが無効または期限切れです')
      authService.authenticate.mockRejectedValue(err)

      await expect(controller.login(loginDto, req, res)).rejects.toBe(err)
      expect(filterError(err).status).toBe(400)
    })
  })

  describe('POST /auth/logout', () => {
    it('logs out successfully; envelope equals ApiResponseUtil.success (200/成功)', async () => {
      const req = mockRequest()
      const res = mockResponse()
      configValues['app.environment'] = 'development'

      const data = await controller.logout(req, res)

      expect(res.clearCookie).toHaveBeenCalledWith('jwt', { path: '/' })
      expect(data).toEqual({ message: 'ログアウト成功' })

      const envelope = await wrapSuccess('logout', data)
      expect(envelope).toEqual(
        expect.objectContaining({
          success: true,
          message: '成功',
          data: expect.objectContaining({ message: 'ログアウト成功' })
        })
      )
    })

    it('handles logout error; filter yields the default 500 envelope', async () => {
      const req = mockRequest()
      const res = mockResponse()
      const err = new Error('Cookie clear failed')
      res.clearCookie.mockImplementation(() => {
        throw err
      })

      await expect(controller.logout(req, res)).rejects.toBe(err)

      const { status, body } = filterError(err)
      expect(status).toBe(500)
      expect(body).toEqual(expect.objectContaining({ message: 'エラーが発生しました', error: 'Cookie clear failed' }))
    })
  })

  describe('エラーハンドリング統合テスト', () => {
    it('validate-token UnauthorizedException → 401 envelope', async () => {
      const err = new UnauthorizedException('トークンが無効です')
      authService.validateToken.mockRejectedValue(err)

      await expect(controller.validateToken('Bearer invalid-token')).rejects.toBe(err)
      const { status, body } = filterError(err)
      expect(status).toBe(401)
      expect(body).toEqual(expect.objectContaining({ message: 'エラーが発生しました', error: 'トークンが無効です' }))
    })

    it('login malformed request throws and does not call authenticate', async () => {
      const loginDto: DiscordLoginDto = { code: null as any }
      const req = mockRequest()
      const res = mockResponse()

      await expect(controller.login(loginDto, req, res)).rejects.toBeInstanceOf(BadRequestException)
      expect(authService.authenticate).not.toHaveBeenCalled()
    })
  })
})
