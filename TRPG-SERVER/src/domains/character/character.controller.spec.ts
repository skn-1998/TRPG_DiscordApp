/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, CallHandler, ArgumentsHost } from '@nestjs/common'
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
import { TypedEventService } from '../../core/events/typed-event.service'
import { Request } from 'express'
import { ResponseInterceptor } from '../../core/http'
import { SuccessResponse } from '../../core/dto/api-response.dto'
import {
  CharacterHttpExceptionFilter,
  CharacterAuthenticationException,
  CharacterNotFoundException
} from './character-http.exception'
import { ApiResponseUtil } from '../../utils/api-response.util'

/**
 * 変換後: ハンドラはデータ（または meta 付き SuccessResponse）を return し、
 * 例外は CharacterAuthenticationException / CharacterNotFoundException / 素の Error を throw する。
 * 封筒化は ResponseInterceptor（成功）/ CharacterHttpExceptionFilter（異常）が担う。
 *
 * 本 spec は実機同様に interceptor / filter を通して最終 envelope を再現し、
 * 変換前の ApiResponseUtil.success / authenticationError / notFoundError / internalServerError と
 * 同一（success/status/message/error/errorCode）であることを検証する（requestId/timestamp は除外）。
 */
describe('CharacterController', () => {
  let controller: CharacterController
  let characterService: jest.Mocked<CharacterService>
  let authService: jest.Mocked<AuthService>
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'emit'>>

  const reflector = new Reflector()

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
    gameSystemId: 'test-system',
    discordChannelId: ''
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

  /** throw された例外を CharacterHttpExceptionFilter に通して { status, body } を得る */
  const filterError = (error: unknown): { status: number; body: any } => {
    const filter = new CharacterHttpExceptionFilter()
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      update: jest.fn(),
      remove: jest.fn(),
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

    const typedEventServiceMock = {
      emit: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterController],
      providers: [
        { provide: CharacterService, useValue: characterServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: TypedEventService, useValue: typedEventServiceMock }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<CharacterController>(CharacterController)
    characterService = module.get(CharacterService)
    authService = module.get(AuthService)
    typedEventService = module.get(TypedEventService)
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

    it('Service作成エラー時は500を返す', async () => {
      const req: any = mockRequest()
      const error = new Error('Character creation failed')
      characterService.create.mockRejectedValue(error)

      await expect(controller.create(mockCharacterDto, req)).rejects.toBe(error)

      // filter 経由で internalServerError と一致
      const { status, body } = filterError(error)
      expect(status).toBe(500)
      expect(stripVolatile(body)).toEqual(
        stripVolatile(refEnvelope((res) => ApiResponseUtil.internalServerError(res, error)))
      )
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

    it('ServiceのfindHavingAllエラー時は500を返す', async () => {
      const req: any = mockRequest()
      const error = new Error('Database error')
      characterService.findHavingAll.mockRejectedValue(error)

      await expect(controller.findAll(req)).rejects.toBe(error)
      expect(filterError(error).status).toBe(500)
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

    it('ServiceのfindUserCharacterSummariesエラー時は500を返す', async () => {
      const req: any = mockRequest()
      const error = new Error('Database error')
      characterService.findUserCharacterSummaries.mockRejectedValue(error)

      await expect(controller.findUserCharacterSummaries(req)).rejects.toBe(error)
      expect(filterError(error).status).toBe(500)
    })
  })

  describe('GET /character/:id', () => {
    it('指定IDのキャラクターを200で返す', async () => {
      const characterId = 'test-character-001'
      characterService.findOne.mockResolvedValue(mockCharacter)

      const data = await controller.findOne({ id: characterId })

      expect(characterService.findOne).toHaveBeenCalledWith(characterId)
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
      characterService.findOne.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.findOne({ id: characterId })
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

    it('ServiceのfindOneエラー時は500を返す', async () => {
      const characterId = 'test-character-001'
      const error = new Error('Database error')
      characterService.findOne.mockRejectedValue(error)

      await expect(controller.findOne({ id: characterId })).rejects.toBe(error)
      expect(filterError(error).status).toBe(500)
    })
  })

  describe('PUT /character/:id', () => {
    it('更新に成功すると200を返しcharacter.updatedイベントを発行する', async () => {
      const characterId = 'test-character-001'
      const updatedCharacter = { ...mockCharacter, ...mockUpdateCharacterDto }
      characterService.update.mockResolvedValue(updatedCharacter)

      const data = await controller.update({ id: characterId }, mockUpdateCharacterDto)

      expect(characterService.update).toHaveBeenCalledWith(characterId, mockUpdateCharacterDto)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.updated',
        expect.objectContaining({ character: updatedCharacter, source: 'character-controller' })
      )
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

    it('更新対象が見つからない場合は404を返しイベントを発行しない', async () => {
      const characterId = 'non-existent-character'
      characterService.update.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.update({ id: characterId }, mockUpdateCharacterDto)
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(CharacterNotFoundException)
      expect(typedEventService.emit).not.toHaveBeenCalled()

      const { status, body } = filterError(thrown)
      expect(status).toBe(404)
      expect(stripVolatile(body)).toEqual(
        stripVolatile(refEnvelope((res) => ApiResponseUtil.notFoundError(res, 'キャラクター')))
      )
    })

    it('Serviceのupdateエラー時は500を返す', async () => {
      const characterId = 'test-character-001'
      const error = new Error('Database error')
      characterService.update.mockRejectedValue(error)

      await expect(controller.update({ id: characterId }, mockUpdateCharacterDto)).rejects.toBe(error)
      expect(filterError(error).status).toBe(500)
    })
  })

  describe('DELETE /character/:id', () => {
    it('削除に成功すると200を返しcharacter.deletedイベントを発行する', async () => {
      const characterId = 'test-character-001'
      characterService.remove.mockResolvedValue(mockCharacter)

      const data = await controller.remove({ id: characterId })

      expect(characterService.remove).toHaveBeenCalledWith(characterId)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.deleted',
        expect.objectContaining({ character: mockCharacter, source: 'character-controller' })
      )
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

    it('削除対象が見つからない場合は404を返しイベントを発行しない', async () => {
      const characterId = 'non-existent-character'
      characterService.remove.mockResolvedValue(null)

      let thrown: unknown
      try {
        await controller.remove({ id: characterId })
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeInstanceOf(CharacterNotFoundException)
      expect(typedEventService.emit).not.toHaveBeenCalled()

      const { status, body } = filterError(thrown)
      expect(status).toBe(404)
      expect(stripVolatile(body)).toEqual(
        stripVolatile(refEnvelope((res) => ApiResponseUtil.notFoundError(res, 'キャラクター')))
      )
    })

    it('Serviceのremoveエラー時は500を返す', async () => {
      const characterId = 'test-character-001'
      const error = new Error('Database error')
      characterService.remove.mockRejectedValue(error)

      await expect(controller.remove({ id: characterId })).rejects.toBe(error)
      expect(filterError(error).status).toBe(500)
    })
  })

  describe('認証ガードテスト', () => {
    it('controllerと依存が正しく構築されている', () => {
      expect(controller).toBeDefined()
      expect(characterService).toBeDefined()
      expect(authService).toBeDefined()
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
          () => controller.findUserCharacterSummaries(req)
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

    it('全メソッドでServiceエラーは500 envelope に整形される', async () => {
      const req: any = mockRequest()
      const serviceError = new Error('Service unavailable')

      characterService.create.mockRejectedValue(serviceError)
      characterService.findHavingAll.mockRejectedValue(serviceError)
      characterService.findUserCharacterSummaries.mockRejectedValue(serviceError)
      characterService.findOne.mockRejectedValue(serviceError)
      characterService.update.mockRejectedValue(serviceError)
      characterService.remove.mockRejectedValue(serviceError)

      for (const act of [
        () => controller.create(mockCharacterDto, req),
        () => controller.findAll(req),
        () => controller.findUserCharacterSummaries(req),
        () => controller.findOne({ id: 'test-id' }),
        () => controller.update({ id: 'test-id' }, mockUpdateCharacterDto),
        () => controller.remove({ id: 'test-id' })
      ]) {
        let thrown: unknown
        try {
          await act()
        } catch (e) {
          thrown = e
        }
        // 変換前は res に 500 を書いて解決していた。変換後は throw → filter が 500 envelope へ整形
        expect(filterError(thrown).status).toBe(500)
      }
    })
  })
})
