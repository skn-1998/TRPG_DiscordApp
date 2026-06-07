import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, CallHandler, ArgumentsHost } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Response } from 'express'
import { lastValueFrom, of } from 'rxjs'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { JwtTokenService } from '../auth/token/jwt-token.service'
import { ResponseInterceptor, HttpExceptionFilter, ApiError } from '../../core/http'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { AppConfigService } from '../../config/config.service'

describe('UserController', () => {
  let controller: UserController
  let service: jest.Mocked<UserService>

  const mockUser = {
    discordUserId: 'discord123',
    name: 'Test User',
    characterIds: []
  }

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

  describe('create', () => {
    it('should create a user', async () => {
      const createUserDto: CreateUserDto = {
        discordUserId: 'discord123',
        name: 'Test User'
      }
      mockUserService.create.mockResolvedValue(mockUser)

      const data = await controller.create(createUserDto)

      expect(service.create).toHaveBeenCalledWith(createUserDto)
      expect(data).toEqual(mockUser)
      await expectSuccessEnvelope('create', data)
    })
  })

  describe('findOne', () => {
    it('should return a user resolved from the authorization token', async () => {
      mockUserService.findByDiscordId.mockResolvedValue(mockUser)

      const data = await controller.findOne('Bearer valid-token')

      expect(mockJwtTokenService.validateToken).toHaveBeenCalledWith('Bearer valid-token')
      expect(service.findByDiscordId).toHaveBeenCalledWith('discord123')
      expect(data).toEqual(mockUser)
      await expectSuccessEnvelope('findOne', data)
    })

    it('should yield 404 when the user is not found', async () => {
      mockUserService.findByDiscordId.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.findOne('Bearer valid-token')
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

      const data = await controller.update({ discordUserId: 'discord123' }, updateUserDto)

      expect(service.update).toHaveBeenCalledWith('discord123', updateUserDto)
      expect(data).toEqual(updatedUser)
      await expectSuccessEnvelope('update', data)
    })
  })

  describe('addCharacter', () => {
    it('should add a character to a user', async () => {
      const updatedUser = { ...mockUser, characterIds: ['character123'] }
      mockUserService.addCharacterId.mockResolvedValue(updatedUser)

      const data = await controller.addCharacter({ discordUserId: 'discord123', characterId: 'character123' })

      expect(service.addCharacterId).toHaveBeenCalledWith('discord123', 'character123')
      expect(data).toEqual(updatedUser)
      await expectSuccessEnvelope('addCharacter', data)
    })
  })

  describe('removeCharacter', () => {
    it('should remove a character from a user', async () => {
      const updatedUser = { ...mockUser, characterIds: [] }
      mockUserService.removeCharacterId.mockResolvedValue(updatedUser)

      const data = await controller.removeCharacter({ discordUserId: 'discord123', characterId: 'character123' })

      expect(service.removeCharacterId).toHaveBeenCalledWith('discord123', 'character123')
      expect(data).toEqual(updatedUser)
      await expectSuccessEnvelope('removeCharacter', data)
    })
  })

  describe('remove', () => {
    it('should remove a user', async () => {
      mockUserService.remove.mockResolvedValue(mockUser)

      const data = await controller.remove({ discordUserId: 'discord123' })

      expect(service.remove).toHaveBeenCalledWith('discord123')
      expect(data).toEqual(mockUser)
      await expectSuccessEnvelope('remove', data)
    })
  })
})
