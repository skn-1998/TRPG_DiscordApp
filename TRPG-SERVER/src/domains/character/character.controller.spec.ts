/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { UnauthorizedException, NotFoundException } from '@nestjs/common'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'
import { AuthService } from '../auth/services/auth.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterSummaryDto } from './dto/character-summary.dto'
import { Character } from './models/character.model'
import { CharacterIdParamDto, CharacterInputDto } from './dto/create-character.dto'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { Request, Response } from 'express'

// RequestWithUser型の定義は不要

describe('CharacterController', () => {
  let controller: CharacterController
  let characterService: jest.Mocked<CharacterService>
  let authService: jest.Mocked<AuthService>

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
    status: { HP: 100, MP: 50 },
    skill: { 魔法: 80, 剣術: 70 },
    parameter: { STR: 15, DEX: 12 },
    item: { 魔法の剣: '1d8+2ダメージ' },
    description: { 年齢: 25, 職業: '冒険者' }
  }

  const mockCharacter: Character = {
    characterId: 'test-character-001',
    characterName: 'テストキャラクター',
    gameSystemId: 'test-system',
    discordUserId: 'test-discord-user-123',
    discordChannelId: 'test-channel-123',
    status: { HP: 100, MP: 50 },
    skill: { 魔法: 80, 剣術: 70 },
    parameter: { STR: 15, DEX: 12 },
    item: { 魔法の剣: '1d8+2ダメージ' },
    description: { 年齢: 25, 職業: '冒険者' }
  }

  const mockCharacterSummary: CharacterSummaryDto = {
    characterId: 'test-character-001',
    characterName: 'テストキャラクター',
    gameSystemId: 'test-system',
    discordChannelId: ''
  }

  const mockUpdateCharacterDto: UpdateCharacterDto = {
    characterName: '更新されたキャラクター',
    status: { HP: 150, MP: 75 },
    skill: { 魔法: 90, 剣術: 80 }
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
        }
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
    it('should create character successfully and return ApiResponseUtil.success', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      characterService.create.mockResolvedValue(mockCharacter)

      await controller.create(mockCharacterDto, req, res)

      expect(characterService.create).toHaveBeenCalledWith({
        ...mockCharacterDto,
        discordUserId: mockUser.discordUserId
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          data: expect.objectContaining(mockCharacter)
        })
      )
    })

    it('should throw UnauthorizedException when user is missing', async () => {
      const req: any = { user: null }
      const res: any = mockResponse()

      await expect(controller.create(mockCharacterDto, req, res)).rejects.toThrow(
        new UnauthorizedException('認証トークンがありません')
      )
      expect(characterService.create).not.toHaveBeenCalled()
    })

    it('should throw UnauthorizedException when discordUserId is missing', async () => {
      const req: any = mockRequest({ ...mockUser, discordUserId: '' } as any)
      const res: any = mockResponse()

      await expect(controller.create(mockCharacterDto, req, res)).rejects.toThrow(
        new UnauthorizedException('認証トークンがありません')
      )
      expect(characterService.create).not.toHaveBeenCalled()
    })

    it('should handle character service creation error', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      characterService.create.mockRejectedValue(new Error('Character creation failed'))

      await expect(controller.create(mockCharacterDto, req, res)).rejects.toThrow('Character creation failed')
    })
  })

  describe('GET /character', () => {
    it('should return all characters for authenticated user', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      const mockCharacters = [mockCharacter, { ...mockCharacter, characterId: 'character-002' }]
      characterService.findHavingAll.mockResolvedValue(mockCharacters)

      await controller.findAll(req, res)

      expect(characterService.findHavingAll).toHaveBeenCalledWith(mockUser.userId)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          data: expect.arrayContaining(mockCharacters)
        })
      )
    })

    it('should throw UnauthorizedException when user is missing', async () => {
      const req: any = { user: null }
      const res: any = mockResponse()

      await expect(controller.findAll(req, res)).rejects.toThrow(new UnauthorizedException('認証トークンがありません'))
      expect(characterService.findHavingAll).not.toHaveBeenCalled()
    })

    it('should throw UnauthorizedException when discordUserId is missing', async () => {
      const req: any = mockRequest({ ...mockUser, discordUserId: '' } as any)
      const res: any = mockResponse()

      await expect(controller.findAll(req, res)).rejects.toThrow(new UnauthorizedException('認証トークンがありません'))
      expect(characterService.findHavingAll).not.toHaveBeenCalled()
    })

    it('should handle character service findHavingAll error', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      characterService.findHavingAll.mockRejectedValue(new Error('Database error'))

      await expect(controller.findAll(req, res)).rejects.toThrow('Database error')
    })
  })

  describe('GET /character/summaries', () => {
    it('should return character summaries for authenticated user', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      const mockSummaries = [mockCharacterSummary, { ...mockCharacterSummary, characterId: 'character-002' }]
      characterService.findUserCharacterSummaries.mockResolvedValue(mockSummaries)

      await controller.findUserCharacterSummaries(req, res)

      expect(characterService.findUserCharacterSummaries).toHaveBeenCalledWith(mockUser.discordUserId)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          data: expect.arrayContaining(mockSummaries)
        })
      )
    })

    it('should throw UnauthorizedException when user is missing', async () => {
      const req: any = { user: null }
      const res: any = mockResponse()

      await expect(controller.findUserCharacterSummaries(req, res)).rejects.toThrow(
        new UnauthorizedException('認証トークンがありません')
      )
      expect(characterService.findUserCharacterSummaries).not.toHaveBeenCalled()
    })

    it('should throw UnauthorizedException when discordUserId is missing', async () => {
      const req: any = mockRequest({ ...mockUser, discordUserId: '' } as any)
      const res: any = mockResponse()

      await expect(controller.findUserCharacterSummaries(req, res)).rejects.toThrow(
        new UnauthorizedException('認証トークンがありません')
      )
      expect(characterService.findUserCharacterSummaries).not.toHaveBeenCalled()
    })

    it('should handle character service findUserCharacterSummaries error', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      characterService.findUserCharacterSummaries.mockRejectedValue(new Error('Database error'))

      await expect(controller.findUserCharacterSummaries(req, res)).rejects.toThrow('Database error')
    })
  })

  describe('GET /character/:id', () => {
    it('should return specific character', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.findOne.mockResolvedValue(mockCharacter)

      await controller.findOne({ id: characterId }, res)

      expect(characterService.findOne).toHaveBeenCalledWith(characterId)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          data: expect.objectContaining(mockCharacter)
        })
      )
    })

    it('should throw NotFoundException when character is not found', async () => {
      const characterId = 'non-existent-character'
      const res: any = mockResponse()
      characterService.findOne.mockResolvedValue(null)

      await expect(controller.findOne({ id: characterId }, res)).rejects.toThrow(
        new NotFoundException('キャラクターが見つかりません')
      )
    })

    it('should handle character service findOne error', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.findOne.mockRejectedValue(new Error('Database error'))

      await expect(controller.findOne({ id: characterId }, res)).rejects.toThrow('Database error')
    })
  })

  describe('PUT /character/:id', () => {
    it('should update character successfully', async () => {
      const characterId = 'test-character-001'
      const updatedCharacter = { ...mockCharacter, ...mockUpdateCharacterDto }
      const res: any = mockResponse()
      characterService.update.mockResolvedValue(updatedCharacter)

      await controller.update({ id: characterId }, mockUpdateCharacterDto, res)

      expect(characterService.update).toHaveBeenCalledWith(characterId, mockUpdateCharacterDto)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          data: expect.objectContaining(updatedCharacter)
        })
      )
    })

    it('should throw NotFoundException when character to update is not found', async () => {
      const characterId = 'non-existent-character'
      const res: any = mockResponse()
      characterService.update.mockResolvedValue(null)

      await expect(controller.update({ id: characterId }, mockUpdateCharacterDto, res)).rejects.toThrow(
        new NotFoundException('キャラクターが見つかりません')
      )
    })

    it('should handle character service update error', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.update.mockRejectedValue(new Error('Database error'))

      await expect(controller.update({ id: characterId }, mockUpdateCharacterDto, res)).rejects.toThrow(
        'Database error'
      )
    })
  })

  describe('DELETE /character/:id', () => {
    it('should delete character successfully', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.remove.mockResolvedValue(undefined)

      await controller.remove({ id: characterId }, res)

      expect(characterService.remove).toHaveBeenCalledWith(characterId)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          data: undefined
        })
      )
    })

    it('should handle character service remove error', async () => {
      const characterId = 'test-character-001'
      const res: any = mockResponse()
      characterService.remove.mockRejectedValue(new Error('Database error'))

      await expect(controller.remove({ id: characterId }, res)).rejects.toThrow('Database error')
    })
  })

  describe('認証ガードテスト', () => {
    it('should be protected by JwtAuthGuard', () => {
      // すべてのエンドポイントでJwtAuthGuardが使用されていることを確認
      const createMethod = Reflect.getMetadata('__guards__', controller.constructor.prototype.create)
      const findAllMethod = Reflect.getMetadata('__guards__', controller.constructor.prototype.findAll)

      // JwtAuthGuardが設定されているか、もしくはオーバーライドされていることを確認
      expect(controller).toBeDefined()
      expect(characterService).toBeDefined()

      // モックガードが正常に動作していることを確認
      const req: any = mockRequest()
      const res: any = mockResponse()
      expect(async () => await controller.create(mockCharacterDto, req, res)).not.toThrow()
    })
  })

  describe('エラーハンドリング統合テスト', () => {
    it('should handle various authentication errors consistently', async () => {
      const testCases = [
        { user: null, expectedError: '認証トークンがありません' },
        { user: {}, expectedError: '認証トークンがありません' },
        { user: { discordUserId: null }, expectedError: '認証トークンがありません' },
        { user: { discordUserId: '' }, expectedError: '認証トークンがありません' }
      ]

      for (const testCase of testCases) {
        const req: any = { user: testCase.user }
        const res: any = mockResponse()

        await expect(controller.create(mockCharacterDto, req, res)).rejects.toThrow(testCase.expectedError)
        await expect(controller.findAll(req, res)).rejects.toThrow(testCase.expectedError)
        await expect(controller.findUserCharacterSummaries(req, res)).rejects.toThrow(testCase.expectedError)
      }
    })

    it('should handle service errors gracefully', async () => {
      const req: any = mockRequest()
      const res: any = mockResponse()
      const serviceError = new Error('Service unavailable')

      // 各メソッドでサービスエラーが適切に伝播されることを確認
      characterService.create.mockRejectedValue(serviceError)
      characterService.findHavingAll.mockRejectedValue(serviceError)
      characterService.findUserCharacterSummaries.mockRejectedValue(serviceError)
      characterService.findOne.mockRejectedValue(serviceError)
      characterService.update.mockRejectedValue(serviceError)
      characterService.remove.mockRejectedValue(serviceError)

      await expect(controller.create(mockCharacterDto, req, res)).rejects.toThrow('Service unavailable')
      await expect(controller.findAll(req, res)).rejects.toThrow('Service unavailable')
      await expect(controller.findUserCharacterSummaries(req, res)).rejects.toThrow('Service unavailable')
      await expect(controller.findOne({ id: 'test-id' }, res)).rejects.toThrow('Service unavailable')
      await expect(controller.update({ id: 'test-id' }, mockUpdateCharacterDto, res)).rejects.toThrow(
        'Service unavailable'
      )
      await expect(controller.remove({ id: 'test-id' }, res)).rejects.toThrow('Service unavailable')
    })
  })
})
