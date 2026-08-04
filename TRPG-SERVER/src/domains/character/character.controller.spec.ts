/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { ArgumentsHost, CallHandler, ConflictException, ExecutionContext, HttpException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Response } from 'express'
import { lastValueFrom, of } from 'rxjs'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'
import { AuthService } from '../auth/services/auth.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterSummaryDto } from './dto/character-summary.dto'
import { Character } from './models/character.model'
import { CharacterInputDto } from './dto/create-character.dto'
import { Request } from 'express'
import { ResponseInterceptor } from '../../core/http'
import { GlobalExceptionFilter } from '../../core/http/global-exception.filter'
import { SuccessResponse } from '../../core/dto/api-response.dto'
import { CharacterAuthenticationException, CharacterNotFoundException } from './character-http.exception'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { AppConfigService } from '../../config/config.service'
import { GUARDS_METADATA } from '@nestjs/common/constants'

/**
 * 変換後: ハンドラはデータ（または meta 付き SuccessResponse）を return し、
 * 例外は CharacterAuthenticationException / CharacterNotFoundException / 素の Error を throw する。
 * 封筒化は ResponseInterceptor（成功）/ GlobalExceptionFilter（異常）が担う。
 *
 * 本 spec は実機同様に interceptor / filter を通して最終 envelope を再現し、
 * 変換前の ApiResponseUtil.success / authenticationError / notFoundError と
 * 同一（success/status/message/error/errorCode）であることを検証する（requestId/timestamp は除外）。
 * 素の Error は controller が同じ値を再 throw することだけを固定し、global 配線は HTTP spec で検証する。
 */
describe('CharacterController', () => {
  let controller: CharacterController
  let characterService: jest.Mocked<CharacterService>
  let authService: jest.Mocked<AuthService>

  const reflector = new Reflector()

  // GlobalExceptionFilter の dev 判定を test 固定にし、ApiResponseUtil.error の既定と同じく stack を含めない。
  const mockAppConfig = {
    get: (path: string) => (path === 'app.environment' ? 'test' : undefined)
  } as unknown as AppConfigService

  // モックデータ定義
  const mockUser = {
    discordUserId: 'test-discord-user-123',
    userId: 'test-user-456',
    userName: 'テストユーザー'
  }

  const mockCharacterDto: CharacterInputDto = {
    characterId: 'test-character-001',
    characterName: 'テストキャラクター',
    gameSystemId: 'test-system',
    discordChannelId: 'test-channel-123',
    status: { HP: { values: { base: 100 } }, MP: { values: { base: 50 } } },
    skill: { 魔法: { values: { base: 80 } }, 剣術: { values: { base: 70 } } },
    parameter: { STR: { values: { base: 15 } }, DEX: { values: { base: 12 } } },
    item: { 魔法の剣: { description: '1d8+2ダメージ' } },
    description: { 年齢: { values: { base: 25 } }, 職業: { description: '冒険者' } }
  }

  const mockCharacter: Character = {
    characterId: 'test-character-001',
    characterName: 'テストキャラクター',
    gameSystemId: 'test-system',
    discordUserId: 'test-discord-user-123',
    discordChannelId: 'test-channel-123',
    status: { HP: { values: { base: 100 } }, MP: { values: { base: 50 } } },
    skill: { 魔法: { values: { base: 80 } }, 剣術: { values: { base: 70 } } },
    parameter: { STR: { values: { base: 15 } }, DEX: { values: { base: 12 } } },
    item: { 魔法の剣: { description: '1d8+2ダメージ' } },
    description: { 年齢: { values: { base: 25 } }, 職業: { description: '冒険者' } }
  }

  const mockCharacterSummary: CharacterSummaryDto = {
    characterId: 'test-character-001',
    characterName: 'テストキャラクター',
    gameSystemId: 'test-system'
  }

  const mockUpdateCharacterDto: UpdateCharacterDto = {
    characterName: '更新されたキャラクター',
    status: { HP: { values: { base: 150 } }, MP: { values: { base: 75 } } },
    skill: { 魔法: { values: { base: 90 } }, 剣術: { values: { base: 80 } } }
  }

  const mockRequest = (user: any = mockUser): Request => {
    return {
      user,
      headers: {},
      body: {},
      query: {},
      params: {},
      get: jest.fn()
    } as unknown as Request
  }

  // --- envelope 再現ヘルパ（実機の interceptor / filter を直接利用） ---

  /** ハンドラ戻り値を ResponseInterceptor に通して最終 envelope（成功）を得る */
  const wrapSuccess = async (method: keyof CharacterController, data: unknown): Promise<any> => {
    const interceptor = new ResponseInterceptor(reflector)
    const ctx = { getHandler: () => controller[method] } as unknown as ExecutionContext
    const next: CallHandler = { handle: () => of(data) }
    return lastValueFrom(interceptor.intercept(ctx, next))
  }

  /** throw された HttpException を GlobalExceptionFilter に通して { status, body } を得る */
  const filterError = (error: unknown): { status: number; body: any } => {
    if (!(error instanceof HttpException)) {
      throw new Error('GlobalExceptionFilter の単体ヘルパには HttpException のみ渡せます')
    }
    const filter = new GlobalExceptionFilter(mockAppConfig)
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
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) })
    } as unknown as ArgumentsHost
    filter.catch(error, host)
    return { status: captured.status!, body: captured.body }
  }

  /** requestId / timestamp を除いた比較用オブジェクト */
  const stripVolatile = (payload: any): Record<string, unknown> => {
    const { requestId, timestamp, ...rest } = payload
    return rest
  }

  /** ApiResponseUtil.* が生成する envelope を取り出す（参照値） */
  const refEnvelope = (fn: (res: Response) => void): any => {
    const ref: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    fn(ref as Response)
    return ref.json.mock.calls[0][0]
  }

  beforeEach(async () => {
    const characterServiceMock = {
      create: jest.fn(),
      findHavingAll: jest.fn(),
      findUserCharacterSummaries: jest.fn(),
      findOne: jest.fn(),
      findOneForOwner: jest.fn(),
      update: jest.fn(),
      updateForOwner: jest.fn(),
      remove: jest.fn(),
      removeForOwner: jest.fn(),
      findByChannelId: jest.fn(),
      removeByChannelId: jest.fn(),
      findByUserId: jest.fn(),
      search: jest.fn()
    }

    const authServiceMock = {
      validateToken: jest.fn(),
      generateJwt: jest.fn(),
      authenticate: jest.fn(),
      getUserInfo: jest.fn(),
      signInAndRegisterUserInfo: jest.fn(),
      signInAndRegisterUserInfoWithTokens: jest.fn(),
      getDiscordGuildsWithToken: jest.fn(),
      getUserDiscordGuilds: jest.fn(),
      parseJwt: jest.fn(),
      validateDiscordUser: jest.fn(),
      getValidDiscordAccessToken: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterController],
      providers: [
        { provide: CharacterService, useValue: characterServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: AppConfigService, useValue: mockAppConfig }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<CharacterController>(CharacterController)
    characterService = module.get(CharacterService)
    authService = module.get(AuthService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('基本機能', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined()
      expect(characterService).toBeDefined()
      expect(authService).toBeDefined()
    })

    it('should have all required methods', () => {
      expect(controller.create).toBeDefined()
      expect(controller.findAll).toBeDefined()
      expect(controller.findUserCharacterSummaries).toBeDefined()
      expect(controller.findOne).toBeDefined()
      expect(controller.update).toBeDefined()
      expect(controller.remove).toBeDefined()
    })
  })

  describe('POST /character', () => {
    it('作成に成功すると201でServiceにdiscordUserIdを付与して委譲する', async () => {
      const req: any = mockRequest()
      characterService.create.mockResolvedValue(mockCharacter)

      const data = await controller.create(mockCharacterDto, req)

      expect(characterService.create).toHaveBeenCalledWith({
        ...mockCharacterDto,
        discordUserId: mockUser.discordUserId
      })
      expect(data).toEqual(mockCharacter)

      // interceptor 経由の最終 envelope（status は @HttpCode(201)、message は @ResponseMessage で保持）
      const envelope = await wrapSuccess('create', data)
      expect(stripVolatile(envelope)).toEqual(
        stripVolatile(
          refEnvelope((res) =>
            ApiResponseUtil.success(res, mockCharacter, 'character', 201, 'キャラクターを作成しました')
          )
        )
      )
    })

    it('userが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = { user: null }

      await expect(controller.create(mockCharacterDto, req)).rejects.toBeInstanceOf(CharacterAuthenticationException)
      expect(characterService.create).not.toHaveBeenCalled()
    })

    it('discordUserIdが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = mockRequest({ ...mockUser, discordUserId: '' } as any)

      let thrown: unknown
      try {
        await controller.create(mockCharacterDto, req)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(CharacterAuthenticationException)
      expect(characterService.create).not.toHaveBeenCalled()

      // filter 経由の最終 envelope が authenticationError と一致
      const { status, body } = filterError(thrown)
      expect(status).toBe(401)
      expect(stripVolatile(body)).toEqual(
        stripVolatile(refEnvelope((res) => ApiResponseUtil.authenticationError(res, '認証トークンがありません')))
      )
    })

    it('Service作成の素の Error はそのまま再 throw する', async () => {
      const req: any = mockRequest()
      const error = new Error('Character creation failed')
      characterService.create.mockRejectedValue(error)

      await expect(controller.create(mockCharacterDto, req)).rejects.toBe(error)
    })
  })

  describe('GET /character', () => {
    it('認証済みユーザーの全キャラクターを200で返す（meta付き）', async () => {
      const req: any = mockRequest()
      const mockCharacters = [mockCharacter, { ...mockCharacter, characterId: 'character-002' }]
      characterService.findHavingAll.mockResolvedValue(mockCharacters)

      const result = await controller.findAll(req)

      expect(characterService.findHavingAll).toHaveBeenCalledWith(mockUser.discordUserId)
      // findAll は meta 保持のため SuccessResponse を直接返す
      expect(result).toBeInstanceOf(SuccessResponse)

      const meta = { total: 2, page: 1, limit: 2, hasNext: false, hasPrev: false }
      // interceptor は SuccessResponse を素通しするため最終 envelope = result
      const envelope = await wrapSuccess('findAll', result)
      expect(envelope).toBe(result)
      expect(stripVolatile(envelope)).toEqual(
        stripVolatile(
          refEnvelope((res) =>
            ApiResponseUtil.success(res, mockCharacters, 'character', 200, 'キャラクター一覧を取得しました', meta)
          )
        )
      )
    })

    it('userが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = { user: null }

      await expect(controller.findAll(req)).rejects.toBeInstanceOf(CharacterAuthenticationException)
      expect(characterService.findHavingAll).not.toHaveBeenCalled()
    })

    it('discordUserIdが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = mockRequest({ ...mockUser, discordUserId: '' } as any)

      await expect(controller.findAll(req)).rejects.toBeInstanceOf(CharacterAuthenticationException)
      expect(characterService.findHavingAll).not.toHaveBeenCalled()
    })

    it('ServiceのfindHavingAllの素の Error はそのまま再 throw する', async () => {
      const req: any = mockRequest()
      const error = new Error('Database error')
      characterService.findHavingAll.mockRejectedValue(error)

      await expect(controller.findAll(req)).rejects.toBe(error)
    })
  })

  describe('GET /character/summaries', () => {
    it('認証済みユーザーのサマリー一覧を200で返す（meta付き）', async () => {
      const req: any = mockRequest()
      const mockSummaries = [mockCharacterSummary, { ...mockCharacterSummary, characterId: 'character-002' }]
      characterService.findUserCharacterSummaries.mockResolvedValue(mockSummaries)

      const result = await controller.findUserCharacterSummaries(req)

      expect(characterService.findUserCharacterSummaries).toHaveBeenCalledWith(mockUser.discordUserId)
      expect(result).toBeInstanceOf(SuccessResponse)

      const meta = { total: 2, page: 1, limit: 2, hasNext: false, hasPrev: false }
      const envelope = await wrapSuccess('findUserCharacterSummaries', result)
      expect(stripVolatile(envelope)).toEqual(
        stripVolatile(
          refEnvelope((res) =>
            ApiResponseUtil.success(res, mockSummaries, 'character', 200, 'キャラクターサマリーを取得しました', meta)
          )
        )
      )
    })

    it('userが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = { user: null }

      await expect(controller.findUserCharacterSummaries(req)).rejects.toBeInstanceOf(CharacterAuthenticationException)
      expect(characterService.findUserCharacterSummaries).not.toHaveBeenCalled()
    })

    it('discordUserIdが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = mockRequest({ ...mockUser, discordUserId: '' } as any)

      await expect(controller.findUserCharacterSummaries(req)).rejects.toBeInstanceOf(CharacterAuthenticationException)
      expect(characterService.findUserCharacterSummaries).not.toHaveBeenCalled()
    })

    it('ServiceのfindUserCharacterSummariesの素の Error はそのまま再 throw する', async () => {
      const req: any = mockRequest()
      const error = new Error('Database error')
      characterService.findUserCharacterSummaries.mockRejectedValue(error)

      await expect(controller.findUserCharacterSummaries(req)).rejects.toBe(error)
    })
  })

  describe('GET /character/:id', () => {
    it('指定IDのキャラクターを200で返す', async () => {
      const characterId = 'test-character-001'
      const req: any = mockRequest()
      characterService.findOneForOwner.mockResolvedValue(mockCharacter)

      const data = await controller.findOne({ id: characterId }, req)

      expect(characterService.findOneForOwner).toHaveBeenCalledWith(characterId, mockUser.discordUserId)
      expect(data).toEqual(mockCharacter)

      const envelope = await wrapSuccess('findOne', data)
      expect(stripVolatile(envelope)).toEqual(
        stripVolatile(
          refEnvelope((res) =>
            ApiResponseUtil.success(res, mockCharacter, 'character', 200, 'キャラクターを取得しました')
          )
        )
      )
    })

    it('キャラクターが見つからない場合は404を返す', async () => {
      const characterId = 'non-existent-character'
      const req: any = mockRequest()
      characterService.findOneForOwner.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.findOne({ id: characterId }, req)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(CharacterNotFoundException)

      const { status, body } = filterError(thrown)
      expect(status).toBe(404)
      expect(stripVolatile(body)).toEqual(
        stripVolatile(refEnvelope((res) => ApiResponseUtil.notFoundError(res, 'キャラクター')))
      )
    })

    it('ServiceのfindOneの素の Error はそのまま再 throw する', async () => {
      const characterId = 'test-character-001'
      const error = new Error('Database error')
      const req: any = mockRequest()
      characterService.findOneForOwner.mockRejectedValue(error)

      await expect(controller.findOne({ id: characterId }, req)).rejects.toBe(error)
    })
  })

  describe('PUT /character/:id', () => {
    it('更新に成功すると200を返し、過去形 character.updated イベントは発行しない', async () => {
      const characterId = 'test-character-001'
      const updatedCharacter = { ...mockCharacter, ...mockUpdateCharacterDto }
      const req: any = mockRequest()
      characterService.updateForOwner.mockResolvedValue(updatedCharacter)

      const data = await controller.update({ id: characterId }, mockUpdateCharacterDto, req)

      expect(characterService.updateForOwner).toHaveBeenCalledWith(
        characterId,
        mockUser.discordUserId,
        mockUpdateCharacterDto
      )
      // E-6b: controller はイベントサービス非注入（イベント不発行は構造的に保証）
      expect(data).toEqual(updatedCharacter)

      const envelope = await wrapSuccess('update', data)
      expect(stripVolatile(envelope)).toEqual(
        stripVolatile(
          refEnvelope((res) =>
            ApiResponseUtil.success(res, updatedCharacter, 'character', 200, 'キャラクターを更新しました')
          )
        )
      )
    })

    it('更新対象が見つからない場合は404を返す', async () => {
      const characterId = 'non-existent-character'
      const req: any = mockRequest()
      characterService.updateForOwner.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.update({ id: characterId }, mockUpdateCharacterDto, req)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(CharacterNotFoundException)

      const { status, body } = filterError(thrown)
      expect(status).toBe(404)
      expect(stripVolatile(body)).toEqual(
        stripVolatile(refEnvelope((res) => ApiResponseUtil.notFoundError(res, 'キャラクター')))
      )
    })

    it('materialized characterのセクション書き込み拒否を409で返す', async () => {
      const conflict = new ConflictException(
        'materialized character sections must be updated via PUT /character/:id/sheet'
      )
      characterService.updateForOwner.mockRejectedValue(conflict)

      let thrown: unknown
      try {
        await controller.update({ id: 'test-character-001' }, mockUpdateCharacterDto, mockRequest())
      } catch (error) {
        thrown = error
      }

      const { status, body } = filterError(thrown)
      expect(status).toBe(409)
      expect(body.error).toContain('PUT /character/:id/sheet')
    })

    it('Serviceのupdateの素の Error はそのまま再 throw する', async () => {
      const characterId = 'test-character-001'
      const error = new Error('Database error')
      const req: any = mockRequest()
      characterService.updateForOwner.mockRejectedValue(error)

      await expect(controller.update({ id: characterId }, mockUpdateCharacterDto, req)).rejects.toBe(error)
    })
  })

  describe('DELETE /character/:id', () => {
    it('削除に成功すると200を返し、過去形 character.deleted イベントは発行しない', async () => {
      const characterId = 'test-character-001'
      const req: any = mockRequest()
      characterService.removeForOwner.mockResolvedValue(mockCharacter)

      const data = await controller.remove({ id: characterId }, req)

      expect(characterService.removeForOwner).toHaveBeenCalledWith(characterId, mockUser.discordUserId)
      // E-6b: controller はイベントサービス非注入（イベント不発行は構造的に保証）
      expect(data).toEqual({ message: 'キャラクターを削除しました', characterId })

      const envelope = await wrapSuccess('remove', data)
      expect(stripVolatile(envelope)).toEqual(
        stripVolatile(
          refEnvelope((res) =>
            ApiResponseUtil.success(
              res,
              { message: 'キャラクターを削除しました', characterId },
              'character',
              200,
              'キャラクターを削除しました'
            )
          )
        )
      )
    })

    it('削除対象が見つからない場合は404を返す', async () => {
      const characterId = 'non-existent-character'
      const req: any = mockRequest()
      characterService.removeForOwner.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.remove({ id: characterId }, req)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(CharacterNotFoundException)

      const { status, body } = filterError(thrown)
      expect(status).toBe(404)
      expect(stripVolatile(body)).toEqual(
        stripVolatile(refEnvelope((res) => ApiResponseUtil.notFoundError(res, 'キャラクター')))
      )
    })

    it('Serviceのremoveの素の Error はそのまま再 throw する', async () => {
      const characterId = 'test-character-001'
      const error = new Error('Database error')
      const req: any = mockRequest()
      characterService.removeForOwner.mockRejectedValue(error)

      await expect(controller.remove({ id: characterId }, req)).rejects.toBe(error)
    })
  })

  describe('認証ガードテスト', () => {
    it('controllerと依存が正しく構築されている', () => {
      expect(controller).toBeDefined()
      expect(characterService).toBeDefined()
      expect(authService).toBeDefined()
    })

    it('全HTTPメソッドがJwtAuthGuardで保護される', () => {
      const methods = ['create', 'findAll', 'findUserCharacterSummaries', 'findOne', 'update', 'remove'] as const

      for (const method of methods) {
        const guards = Reflect.getMetadata(GUARDS_METADATA, CharacterController.prototype[method]) as unknown[]
        expect(guards).toContain(JwtAuthGuard)
      }
    })
  })

  describe('エラーハンドリング統合テスト', () => {
    it('各種の認証欠落パターンで一貫して401(CharacterAuthenticationException)を投げる', async () => {
      const userCases = [null, {}, { discordUserId: null }, { discordUserId: '' }]

      for (const user of userCases) {
        const req: any = { user }

        for (const act of [
          () => controller.create(mockCharacterDto, req),
          () => controller.findAll(req),
          () => controller.findUserCharacterSummaries(req),
          () => controller.findOne({ id: 'test-id' }, req),
          () => controller.update({ id: 'test-id' }, mockUpdateCharacterDto, req),
          () => controller.remove({ id: 'test-id' }, req)
        ]) {
          let thrown: unknown
          try {
            await act()
          } catch (e) {
            thrown = e
          }
          expect(thrown).toBeInstanceOf(CharacterAuthenticationException)
          // filter 経由で 401 envelope（authenticationError と一致）
          expect(filterError(thrown).status).toBe(401)
        }
      }
    })

    it('全メソッドで Service の素の Error をそのまま再 throw する', async () => {
      const req: any = mockRequest()
      const serviceError = new Error('Service unavailable')

      characterService.create.mockRejectedValue(serviceError)
      characterService.findHavingAll.mockRejectedValue(serviceError)
      characterService.findUserCharacterSummaries.mockRejectedValue(serviceError)
      characterService.findOneForOwner.mockRejectedValue(serviceError)
      characterService.updateForOwner.mockRejectedValue(serviceError)
      characterService.removeForOwner.mockRejectedValue(serviceError)

      for (const act of [
        () => controller.create(mockCharacterDto, req),
        () => controller.findAll(req),
        () => controller.findUserCharacterSummaries(req),
        () => controller.findOne({ id: 'test-id' }, req),
        () => controller.update({ id: 'test-id' }, mockUpdateCharacterDto, req),
        () => controller.remove({ id: 'test-id' }, req)
      ]) {
        let thrown: unknown
        try {
          await act()
        } catch (e) {
          thrown = e
        }
        expect(thrown).toBe(serviceError)
      }
    })
  })
})
