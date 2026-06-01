/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'
import { AuthService } from '../auth/services/auth.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterSummaryDto } from './dto/character-summary.dto'
import { Character } from './models/character.model'
import { CharacterInputDto } from './dto/create-character.dto'
import { TypedEventService } from '../../core/events/typed-event.service'
import { Request, Response } from 'express'

// RequestWithUser型の定義は不要

describe('CharacterController', () => {
  let controller: CharacterController
  let characterService: jest.Mocked<CharacterService>
  let authService: jest.Mocked<AuthService>
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'emit'>>

  // モックデータ定義
  const mockUser = {
    discordUserId: 'test-discord-user-123',
    userId: 'test-user-456',
    userName: 'テストユーザー'
  }

  // CharacterInputDtoを使用した型安全なモックデータ
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

  // mockRequest: Express.Request型に準拠
  const mockRequest = (user: any = mockUser): Request => {
    return {
      user,
      // Express.Requestの必須プロパティを最低限追加
      headers: {},
      body: {},
      query: {},
      params: {},
      get: jest.fn()
      // ...他の必要なプロパティはテストごとに追加
    } as unknown as Request
  }

  // mockResponse: Express.Response型に準拠
  const mockResponse = (): Response => {
    const res = {} as Partial<Response>
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    // ...他の必要なメソッドはテストごとに追加
    return res as Response
  }

  beforeEach(async () => {
    // CharacterService用のモック
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

    // AuthService用のモック
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

    // TypedEventService（副作用境界）用のモック
    const typedEventServiceMock = {
      emit: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterController],
      providers: [
        {
          provide: CharacterService,
          useValue: characterServiceMock
        },
        {
          provide: AuthService,
          useValue: authServiceMock
        },
        {
          provide: TypedEventService,
          useValue: typedEventServiceMock
        }
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
      // Arrange
      const req: any = mockRequest()
      const res: any = mockResponse()
      characterService.create.mockResolvedValue(mockCharacter)

      // Act
      await controller.create(mockCharacterDto, req, res)

      // Assert: 委譲とレスポンスの両方を検証
      expect(characterService.create).toHaveBeenCalledWith({
        ...mockCharacterDto,
        discordUserId: mockUser.discordUserId
      })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining(mockCharacter)
        })
      )
    })

    it('userが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = { user: null }
      const res: any = mockResponse()

      await controller.create(mockCharacterDto, req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(characterService.create).not.toHaveBeenCalled()
    })

    it('discordUserIdが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = mockRequest({ ...mockUser, discordUserId: '' } as any)
      const res: any = mockResponse()

      await controller.create(mockCharacterDto, req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(characterService.create).not.toHaveBeenCalled()
    })

    it('Service作成エラー時は500を返す', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      characterService.create.mockRejectedValue(new Error('Character creation failed'))

      await controller.create(mockCharacterDto, req, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('GET /character', () => {
    it('認証済みユーザーの全キャラクターを200で返す', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      const mockCharacters = [mockCharacter, { ...mockCharacter, characterId: 'character-002' }]
      characterService.findHavingAll.mockResolvedValue(mockCharacters)

      await controller.findAll(req, res)

      expect(characterService.findHavingAll).toHaveBeenCalledWith(mockUser.discordUserId)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining(mockCharacters)
        })
      )
    })

    it('userが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = { user: null }
      const res: any = mockResponse()

      await controller.findAll(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(characterService.findHavingAll).not.toHaveBeenCalled()
    })

    it('discordUserIdが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = mockRequest({ ...mockUser, discordUserId: '' } as any)
      const res: any = mockResponse()

      await controller.findAll(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(characterService.findHavingAll).not.toHaveBeenCalled()
    })

    it('ServiceのfindHavingAllエラー時は500を返す', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      characterService.findHavingAll.mockRejectedValue(new Error('Database error'))

      await controller.findAll(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('GET /character/summaries', () => {
    it('認証済みユーザーのサマリー一覧を200で返す', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      const mockSummaries = [mockCharacterSummary, { ...mockCharacterSummary, characterId: 'character-002' }]
      characterService.findUserCharacterSummaries.mockResolvedValue(mockSummaries)

      await controller.findUserCharacterSummaries(req, res)

      expect(characterService.findUserCharacterSummaries).toHaveBeenCalledWith(mockUser.discordUserId)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining(mockSummaries)
        })
      )
    })

    it('userが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = { user: null }
      const res: any = mockResponse()

      await controller.findUserCharacterSummaries(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(characterService.findUserCharacterSummaries).not.toHaveBeenCalled()
    })

    it('discordUserIdが無い場合は401を返しServiceを呼ばない', async () => {
      const req: any = mockRequest({ ...mockUser, discordUserId: '' } as any)
      const res: any = mockResponse()

      await controller.findUserCharacterSummaries(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(characterService.findUserCharacterSummaries).not.toHaveBeenCalled()
    })

    it('ServiceのfindUserCharacterSummariesエラー時は500を返す', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      characterService.findUserCharacterSummaries.mockRejectedValue(new Error('Database error'))

      await controller.findUserCharacterSummaries(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('GET /character/:id', () => {
    it('指定IDのキャラクターを200で返す', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.findOne.mockResolvedValue(mockCharacter)

      await controller.findOne({ id: characterId }, res)

      expect(characterService.findOne).toHaveBeenCalledWith(characterId)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining(mockCharacter)
        })
      )
    })

    it('キャラクターが見つからない場合は404を返す', async () => {
      const characterId = 'non-existent-character'
      const res: any = mockResponse()
      characterService.findOne.mockResolvedValue(null)

      await controller.findOne({ id: characterId }, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('ServiceのfindOneエラー時は500を返す', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.findOne.mockRejectedValue(new Error('Database error'))

      await controller.findOne({ id: characterId }, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('PUT /character/:id', () => {
    it('更新に成功すると200を返しcharacter.updatedイベントを発行する', async () => {
      const characterId = 'test-character-001'
      const updatedCharacter = { ...mockCharacter, ...mockUpdateCharacterDto }
      const res: any = mockResponse()
      characterService.update.mockResolvedValue(updatedCharacter)

      await controller.update({ id: characterId }, mockUpdateCharacterDto, res)

      expect(characterService.update).toHaveBeenCalledWith(characterId, mockUpdateCharacterDto)
      // 副作用（イベント発行）の検証
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.updated',
        expect.objectContaining({
          character: updatedCharacter,
          source: 'character-controller'
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining(updatedCharacter)
        })
      )
    })

    it('更新対象が見つからない場合は404を返しイベントを発行しない', async () => {
      const characterId = 'non-existent-character'
      const res: any = mockResponse()
      characterService.update.mockResolvedValue(null)

      await controller.update({ id: characterId }, mockUpdateCharacterDto, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('Serviceのupdateエラー時は500を返す', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.update.mockRejectedValue(new Error('Database error'))

      await controller.update({ id: characterId }, mockUpdateCharacterDto, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('DELETE /character/:id', () => {
    it('削除に成功すると200を返しcharacter.deletedイベントを発行する', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.remove.mockResolvedValue(mockCharacter)

      await controller.remove({ id: characterId }, res)

      expect(characterService.remove).toHaveBeenCalledWith(characterId)
      // 副作用（イベント発行）の検証
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.deleted',
        expect.objectContaining({
          character: mockCharacter,
          source: 'character-controller'
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ characterId })
        })
      )
    })

    it('削除対象が見つからない場合は404を返しイベントを発行しない', async () => {
      const characterId = 'non-existent-character'
      const res: any = mockResponse()
      characterService.remove.mockResolvedValue(null)

      await controller.remove({ id: characterId }, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('Serviceのremoveエラー時は500を返す', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.remove.mockRejectedValue(new Error('Database error'))

      await controller.remove({ id: characterId }, res)

      expect(res.status).toHaveBeenCalledWith(500)
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
    it('各種の認証欠落パターンで一貫して401を返す', async () => {
      const userCases = [null, {}, { discordUserId: null }, { discordUserId: '' }]

      for (const user of userCases) {
        const req: any = { user }
        const res: any = mockResponse()

        await controller.create(mockCharacterDto, req, res)
        await controller.findAll(req, res)
        await controller.findUserCharacterSummaries(req, res)

        // create/findAll/findUserCharacterSummaries の3回とも401
        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.status).toHaveBeenCalledTimes(3)
      }
    })

    it('全メソッドでServiceエラーは500として返る（throwしない）', async () => {
      const req: any = mockRequest()
      const serviceError = new Error('Service unavailable')

      // 各メソッドでサービスエラーが500レスポンスに変換されることを確認
      characterService.create.mockRejectedValue(serviceError)
      characterService.findHavingAll.mockRejectedValue(serviceError)
      characterService.findUserCharacterSummaries.mockRejectedValue(serviceError)
      characterService.findOne.mockRejectedValue(serviceError)
      characterService.update.mockRejectedValue(serviceError)
      characterService.remove.mockRejectedValue(serviceError)

      for (const act of [
        () => controller.create(mockCharacterDto, req, mockResponse() as any),
        () => controller.findAll(req, mockResponse() as any),
        () => controller.findUserCharacterSummaries(req, mockResponse() as any),
        () => controller.findOne({ id: 'test-id' }, mockResponse() as any),
        () => controller.update({ id: 'test-id' }, mockUpdateCharacterDto, mockResponse() as any),
        () => controller.remove({ id: 'test-id' }, mockResponse() as any)
      ]) {
        // throwせずに解決すること自体が「graceful」を保証
        await expect(act()).resolves.toBeUndefined()
      }
    })
  })
})
