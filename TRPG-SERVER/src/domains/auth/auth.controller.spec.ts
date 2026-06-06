import { Test, TestingModule } from '@nestjs/testing'
import { Request, Response } from 'express'
import { HttpStatus, BadRequestException, ExecutionContext, CallHandler, ArgumentsHost } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { lastValueFrom, of } from 'rxjs'
import { AuthController } from './auth.controller'
import { AuthService } from './services/auth.service'
import { UserService } from '../user/user.service'
import { DiscordLoginDto, ValidateTokenHeaderDto, GetUserParamDto } from './dto/discord-login.dto'
import { DiscordUserProfile } from './models/discord-user.model'
import { JwtTokenPayload } from './models/auth.token.model'
import { User } from '../user/models/user.model'
import { CookieService } from '../../core/http/cookie.service'
import {
  ResponseInterceptor,
  HttpExceptionFilter,
  RESPONSE_MESSAGE_KEY,
  API_ERROR_RESPONSE_KEY,
  ApiError,
  ApiErrorResponseMeta
} from '../../core/http'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { AppConfigService } from '../../config/config.service'

// Express の Request.user は src/types/express/index.d.ts で
// `user?: JwtTokenPayload` として拡張されている。テストではこれに準拠する。
type RequestWithUser = Request & { user: JwtTokenPayload }

describe('AuthController', () => {
  let controller: AuthController
  let authService: jest.Mocked<AuthService>
  let userService: jest.Mocked<UserService>
  const configValues: Record<string, string> = {
    'app.environment': 'development',
    'app.frontendUrl': 'http://localhost:3000'
  }

  // テストデータ
  const mockUser: User = {
    discordUserId: 'test-discord-id',
    name: 'Test User',
    avatarHash: 'test-avatar-hash',
    characterIds: [],
    discordAccessToken: 'test-access-token',
    discordRefreshToken: 'test-refresh-token',
    discordTokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
    discordTokenScope: 'identify guilds'
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

  /** メソッド名から @ResponseMessage / @ApiErrorResponse メタを実機同様に読む */
  const readMessage = (method: keyof AuthController): string =>
    reflector.get<string>(RESPONSE_MESSAGE_KEY, controller[method] as any) ?? '成功'
  const readErrorMeta = (method: keyof AuthController): ApiErrorResponseMeta | undefined =>
    reflector.get<ApiErrorResponseMeta>(API_ERROR_RESPONSE_KEY, controller[method] as any)

  /** ハンドラの戻り値を ResponseInterceptor に通して最終 envelope を得る */
  const wrapSuccess = async (method: keyof AuthController, data: unknown): Promise<any> => {
    const interceptor = new ResponseInterceptor(reflector)
    const ctx = { getHandler: () => controller[method] } as unknown as ExecutionContext
    const next: CallHandler = { handle: () => of(data) }
    return lastValueFrom(interceptor.intercept(ctx, next))
  }

  /** ハンドラから throw された例外を HttpExceptionFilter に通して最終 envelope/status を得る */
  const filterError = (method: keyof AuthController, error: unknown): { status: number; body: any } => {
    const filter = new HttpExceptionFilter(reflector)
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
      getHandler: () => controller[method]
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

    const userServiceMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findAll: jest.fn(),
      addCharacterId: jest.fn(),
      removeCharacterId: jest.fn()
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
        { provide: UserService, useValue: userServiceMock },
        { provide: AppConfigService, useValue: appConfigServiceMock },
        // CookieService は res を操作するだけの副作用境界。外部依存が無いため
        // モックせず実体を登録し、res.cookie / res.clearCookie の呼び出しを検証する。
        CookieService
      ]
    }).compile()

    controller = module.get<AuthController>(AuthController)
    authService = module.get(AuthService)
    userService = module.get(UserService)
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
      expect(controller.getUser).toBeDefined()
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

    it('should throw on missing profile (filter integrates to 401/Discord認証コールバックに失敗しました)', async () => {
      const req = { ...mockRequest(), user: null }
      const res = mockResponse()

      // 変換後: profile 不在は例外を throw（filter が 401 整形）。res は触らない。
      await expect(controller.discordLoginCallback(req, res)).rejects.toBeInstanceOf(BadRequestException)
      expect(res.cookie).not.toHaveBeenCalled()
      expect(res.redirect).not.toHaveBeenCalled()

      // filter を通すと変換前の ApiResponseUtil.error(res, error, 401, label) と一致
      let thrown: unknown
      try {
        await controller.discordLoginCallback(req, res)
      } catch (e) {
        thrown = e
      }
      const { status, body } = filterError('discordLoginCallback', thrown)
      expect(status).toBe(401)
      expect(body).toEqual(
        expect.objectContaining({ success: false, message: 'Discord認証コールバックに失敗しました' })
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
      const headers: ValidateTokenHeaderDto = { Authorization: 'Bearer valid-token' }
      authService.validateToken.mockResolvedValue(mockJwtPayload)

      const output = await controller.validateToken(headers)

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

    it('throws on invalid token; filter yields 401/トークン検証に失敗しました', async () => {
      const headers: ValidateTokenHeaderDto = { Authorization: 'Bearer invalid-token' }
      const err = new Error('Invalid token')
      authService.validateToken.mockRejectedValue(err)

      await expect(controller.validateToken(headers)).rejects.toBe(err)

      const { status, body } = filterError('validateToken', err)
      expect(status).toBe(401)
      expect(body).toEqual(
        expect.objectContaining({ message: 'トークン検証に失敗しました', error: expect.any(String) })
      )

      // 変換前の ApiResponseUtil.error と完全一致（requestId/timestamp 除く）
      const ref = mockResponse()
      ApiResponseUtil.error(ref, err, 401, 'トークン検証に失敗しました')
      expect(stripVolatile(body)).toEqual(stripVolatile(ref.json.mock.calls[0][0]))
    })

    it('delegates empty authorization header to AuthService (DTO validation is by pipes)', async () => {
      const headers = { Authorization: '' } as any
      const err = new Error('認証ヘッダーが無効または欠落しています')
      authService.validateToken.mockRejectedValue(err)

      await expect(controller.validateToken(headers)).rejects.toBe(err)
      expect(authService.validateToken).toHaveBeenCalledWith('')
      expect(filterError('validateToken', err).status).toBe(401)
    })
  })

  describe('POST /auth/login', () => {
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
            token: 'test-jwt-token'
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

    it('handles authentication error; filter yields 401', async () => {
      const loginDto: DiscordLoginDto = { code: 'invalid-code' }
      const req = mockRequest()
      const res = mockResponse()
      const err = new Error('Authentication failed')
      authService.authenticate.mockRejectedValue(err)

      await expect(controller.login(loginDto, req, res)).rejects.toBe(err)
      expect(filterError('login', err).status).toBe(401)
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

    it('handles logout error; filter yields 500/ログアウトに失敗しました', async () => {
      const req = mockRequest()
      const res = mockResponse()
      const err = new Error('Cookie clear failed')
      res.clearCookie.mockImplementation(() => {
        throw err
      })

      await expect(controller.logout(req, res)).rejects.toBe(err)

      const { status, body } = filterError('logout', err)
      expect(status).toBe(500)
      expect(body).toEqual(
        expect.objectContaining({ message: 'ログアウトに失敗しました', error: 'Cookie clear failed' })
      )
    })
  })

  describe('GET /auth/:userId/User', () => {
    it('gets user successfully; envelope equals ApiResponseUtil.success', async () => {
      const params: GetUserParamDto = { userId: 'test-discord-id' }
      userService.findOne.mockResolvedValue(mockUser)

      const data = await controller.getUser(params)

      expect(userService.findOne).toHaveBeenCalledWith('test-discord-id')
      expect(data).toEqual({ user: mockUser })

      const envelope = await wrapSuccess('getUser', data)
      expect(envelope).toEqual(
        expect.objectContaining({
          success: true,
          message: '成功',
          data: expect.objectContaining({ user: mockUser })
        })
      )
    })

    it('handles user not found; filter yields 404 with "が見つかりません"', async () => {
      const params: GetUserParamDto = { userId: 'non-existent-user' }
      userService.findOne.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.getUser(params)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(ApiError)

      const { status, body } = filterError('getUser', thrown)
      expect(status).toBe(404)
      expect(body).toEqual(
        expect.objectContaining({ success: false, error: expect.stringContaining('が見つかりません') })
      )

      // 変換前 ApiResponseUtil.error(res, '...が見つかりません', 404) と一致
      const ref = mockResponse()
      ApiResponseUtil.error(ref, `ユーザーID ${params.userId} が見つかりません`, 404)
      expect(stripVolatile(body)).toEqual(stripVolatile(ref.json.mock.calls[0][0]))
    })

    it('handles database error; filter yields 500/ユーザー情報の取得に失敗しました', async () => {
      const params: GetUserParamDto = { userId: 'test-discord-id' }
      const err = new Error('Database error')
      userService.findOne.mockRejectedValue(err)

      await expect(controller.getUser(params)).rejects.toBe(err)

      const { status, body } = filterError('getUser', err)
      expect(status).toBe(500)
      expect(body).toEqual(
        expect.objectContaining({ message: 'ユーザー情報の取得に失敗しました', error: expect.any(String) })
      )
    })

    it('delegates empty userId to UserService (DTO validation is by pipes) → 404', async () => {
      const params = { userId: '' } as any
      userService.findOne.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.getUser(params)
      } catch (e) {
        thrown = e
      }
      expect(userService.findOne).toHaveBeenCalledWith('')
      expect(filterError('getUser', thrown).status).toBe(404)
    })
  })

  describe('エラーハンドリング統合テスト', () => {
    it('validate-token service error → 401/トークン検証に失敗しました', async () => {
      const headers: ValidateTokenHeaderDto = { Authorization: 'Bearer invalid-token' }
      const err = new Error('Service error')
      authService.validateToken.mockRejectedValue(err)

      await expect(controller.validateToken(headers)).rejects.toBe(err)
      const { status, body } = filterError('validateToken', err)
      expect(status).toBe(401)
      expect(body).toEqual(
        expect.objectContaining({ message: 'トークン検証に失敗しました', error: expect.any(String) })
      )
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
