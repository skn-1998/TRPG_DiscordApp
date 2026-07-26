import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, CallHandler, ArgumentsHost } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Response } from 'express'
import { lastValueFrom, of } from 'rxjs'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { UpdateUserDto } from './dto/update-user.dto'
import { JwtTokenService } from '../auth/token/jwt-token.service'
import { ResponseInterceptor, HttpExceptionFilter, ApiError } from '../../core/http'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { AppConfigService } from '../../config/config.service'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

describe('UserController', () => {
  let controller: UserController
  let service: jest.Mocked<UserService>

  const mockUser = {
    discordUserId: 'discord123',
    name: 'Test User',
    characterIds: []
  }

  const privateUser = {
    ...mockUser,
    discordAccessToken: 'encrypted-access',
    discordRefreshToken: 'encrypted-refresh',
    discordTokenExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
    discordTokenScope: 'identify guilds'
  }

  const mockRequest = (discordUserId = 'discord123') => ({
    user: { discordUserId, username: 'testuser' }
  })

  const mockUserService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByDiscordId: jest.fn(),
    update: jest.fn(),
    addCharacterId: jest.fn(),
    removeCharacterId: jest.fn(),
    remove: jest.fn()
  }

  const mockJwtTokenService = {
    validateToken: jest.fn().mockResolvedValue({
      discordUserId: 'discord123',
      username: 'testuser'
    })
  }

  const reflector = new Reflector()

  // P1-C: HttpExceptionFilter は @UseFilters(class) 経由で DI 解決される（本番は @Global な
  // AppConfigModule が供給）。TestingModule と filterError の両方で AppConfigService(mock) が要る。
  // test 環境想定で非 development を返す＝stack 非含有（ApiResponseUtil.error の既定と一致）。
  const mockAppConfig = {
    get: (path: string) => (path === 'app.environment' ? 'test' : undefined)
  } as unknown as AppConfigService

  // 変換後: ハンドラはデータを return / 例外を throw し、
  // ResponseInterceptor / HttpExceptionFilter が封筒化する。
  // 以下のヘルパで実機同様に最終 envelope を再現し、変換前の
  // ApiResponseUtil.success/error と同形であることを検証する。

  const wrapSuccess = async (method: keyof UserController, data: unknown): Promise<any> => {
    const interceptor = new ResponseInterceptor(reflector)
    const ctx = { getHandler: () => controller[method] } as unknown as ExecutionContext
    const next: CallHandler = { handle: () => of(data) }
    return lastValueFrom(interceptor.intercept(ctx, next))
  }

  const filterError = (method: keyof UserController, error: unknown): { status: number; body: any } => {
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
      getHandler: () => controller[method]
    } as unknown as ArgumentsHost
    filter.catch(error, host)
    return { status: captured.status!, body: captured.body }
  }

  const stripVolatile = (payload: any): Record<string, unknown> => {
    const { requestId, timestamp, ...rest } = payload
    return rest
  }

  // 変換前 expectSuccess(res, data) 相当: 戻り値を interceptor に通して 200/成功 envelope を確認
  const expectSuccessEnvelope = async (method: keyof UserController, data: unknown): Promise<void> => {
    const envelope = await wrapSuccess(method, data)
    expect(envelope).toEqual(
      expect.objectContaining({
        success: true,
        message: '成功',
        data
      })
    )
  }

  const expectNotFound = async (action: () => Promise<unknown>): Promise<void> => {
    let thrown: unknown
    try {
      await action()
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(ApiError)
    expect((thrown as ApiError).getStatus()).toBe(404)
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: JwtTokenService, useValue: mockJwtTokenService },
        { provide: AppConfigService, useValue: mockAppConfig }
      ]
    }).compile()

    controller = module.get<UserController>(UserController)
    service = module.get(UserService)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('controller全体がJwtAuthGuardで保護される', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, UserController) as unknown[]

    expect(guards).toContain(JwtAuthGuard)
  })

  describe('create', () => {
    it('should create a user', async () => {
      const createUserDto = {
        name: 'Test User'
      }
      mockUserService.create.mockResolvedValue(mockUser)

      const data = await controller.create(createUserDto, mockRequest() as any)

      expect(service.create).toHaveBeenCalledWith({
        discordUserId: 'discord123',
        name: 'Test User',
        avatarHash: undefined,
        characterIds: []
      })
      expect(data).toEqual(mockUser)
      await expectSuccessEnvelope('create', data)
    })
  })

  describe('findOne', () => {
    it('should return a user resolved from the authorization token', async () => {
      mockUserService.findByDiscordId.mockResolvedValue(mockUser)

      const data = await controller.findOne(mockRequest() as any)

      expect(service.findByDiscordId).toHaveBeenCalledWith('discord123')
      expect(data).toEqual(mockUser)
      await expectSuccessEnvelope('findOne', data)
    })

    it('should yield 404 when the user is not found', async () => {
      mockUserService.findByDiscordId.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.findOne(mockRequest() as any)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(ApiError)

      const { status, body } = filterError('findOne', thrown)
      expect(status).toBe(404)
      expect(body).toEqual(expect.objectContaining({ success: false, error: expect.any(String) }))

      // 変換前 ApiResponseUtil.error(res, 'ユーザーが見つかりません', 404) と一致
      const ref: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
      ApiResponseUtil.error(ref, 'ユーザーが見つかりません', 404)
      expect(stripVolatile(body)).toEqual(stripVolatile(ref.json.mock.calls[0][0]))
    })
  })

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto: UpdateUserDto = { name: 'Updated Name' }
      const updatedUser = { ...mockUser, name: 'Updated Name' }
      mockUserService.update.mockResolvedValue(updatedUser)

      const data = await controller.update({ discordUserId: 'discord123' }, updateUserDto, mockRequest() as any)

      expect(service.update).toHaveBeenCalledWith('discord123', updateUserDto)
      expect(data).toEqual(updatedUser)
      await expectSuccessEnvelope('update', data)
    })
  })

  describe('addCharacter', () => {
    it('should add a character to a user', async () => {
      const updatedUser = { ...mockUser, characterIds: ['character123'] }
      mockUserService.addCharacterId.mockResolvedValue(updatedUser)

      const data = await controller.addCharacter(
        { discordUserId: 'discord123', characterId: 'character123' },
        mockRequest() as any
      )

      expect(service.addCharacterId).toHaveBeenCalledWith('discord123', 'character123')
      expect(data).toEqual(updatedUser)
      await expectSuccessEnvelope('addCharacter', data)
    })
  })

  describe('removeCharacter', () => {
    it('should remove a character from a user', async () => {
      const updatedUser = { ...mockUser, characterIds: [] }
      mockUserService.removeCharacterId.mockResolvedValue(updatedUser)

      const data = await controller.removeCharacter(
        { discordUserId: 'discord123', characterId: 'character123' },
        mockRequest() as any
      )

      expect(service.removeCharacterId).toHaveBeenCalledWith('discord123', 'character123')
      expect(data).toEqual(updatedUser)
      await expectSuccessEnvelope('removeCharacter', data)
    })
  })

  describe('remove', () => {
    it('should remove a user', async () => {
      mockUserService.remove.mockResolvedValue(mockUser)

      const data = await controller.remove({ discordUserId: 'discord123' }, mockRequest() as any)

      expect(service.remove).toHaveBeenCalledWith('discord123')
      expect(data).toEqual(mockUser)
      await expectSuccessEnvelope('remove', data)
    })
  })

  describe('認証・所有権・出力契約', () => {
    it('認証主体が無い場合は401で停止しserviceを呼ばない', async () => {
      let thrown: unknown
      try {
        await controller.findOne({ user: null } as any)
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(ApiError)
      expect((thrown as ApiError).getStatus()).toBe(401)
      expect(service.findByDiscordId).not.toHaveBeenCalled()
    })

    it('create は認証主体のIDと公開プロフィール項目だけをserviceへ渡す', async () => {
      mockUserService.create.mockResolvedValue(privateUser)
      const body = {
        discordUserId: 'victim',
        name: 'Test User',
        avatarHash: 'avatar',
        characterIds: ['foreign-character'],
        discordAccessToken: 'client-supplied-token'
      }

      const data = await (controller as any).create(body, mockRequest())

      expect(service.create).toHaveBeenCalledWith({
        discordUserId: 'discord123',
        name: 'Test User',
        avatarHash: 'avatar',
        characterIds: []
      })
      expect(data).toEqual({
        discordUserId: 'discord123',
        name: 'Test User',
        characterIds: []
      })
    })

    it('findOne は認証主体だけを取得しtoken項目を返さない', async () => {
      mockUserService.findByDiscordId.mockResolvedValue(privateUser)

      const data = await (controller as any).findOne(mockRequest())

      expect(service.findByDiscordId).toHaveBeenCalledWith('discord123')
      expect(data).toEqual({
        discordUserId: 'discord123',
        name: 'Test User',
        characterIds: []
      })
      expect(data).not.toHaveProperty('discordAccessToken')
      expect(data).not.toHaveProperty('discordRefreshToken')
    })

    it('update は認証主体と異なるpathのユーザーを404で拒否し永続化しない', async () => {
      mockUserService.update.mockResolvedValue(privateUser)

      await expectNotFound(() =>
        (controller as any).update({ discordUserId: 'victim' }, { name: 'Changed' }, mockRequest())
      )
      expect(service.update).not.toHaveBeenCalled()
    })

    it('update は公開プロフィール項目だけをserviceへ渡す', async () => {
      mockUserService.update.mockResolvedValue(privateUser)

      await (controller as any).update(
        { discordUserId: 'discord123' },
        { name: 'Changed', discordAccessToken: 'client-supplied-token', characterIds: ['foreign'] },
        mockRequest()
      )

      expect(service.update).toHaveBeenCalledWith('discord123', {
        name: 'Changed'
      })
    })

    it.each([
      ['addCharacter', 'addCharacterId', { discordUserId: 'victim', characterId: 'c1' }],
      ['removeCharacter', 'removeCharacterId', { discordUserId: 'victim', characterId: 'c1' }],
      ['remove', 'remove', { discordUserId: 'victim' }]
    ] as const)('%s は認証主体と異なるpathを拒否する', async (method, serviceMethod, params) => {
      await expectNotFound(() => (controller[method] as any)(params, mockRequest()))
      expect(service[serviceMethod]).not.toHaveBeenCalled()
    })
  })
})
