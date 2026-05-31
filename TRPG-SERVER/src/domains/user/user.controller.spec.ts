import { Test, TestingModule } from '@nestjs/testing'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { AuthService } from '../auth/services/auth.service'
import { Response } from 'express'

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

  const mockAuthService = {
    validateToken: jest.fn().mockResolvedValue({
      discordUserId: 'discord123',
      username: 'testuser'
    })
  }

  // mockResponse: status().json() チェーンを再現する Express.Response 互換モック
  const mockResponse = (): any => {
    const res: Partial<Response> = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    return res as Response
  }

  // ApiResponseUtil.success が生成する成功レスポンスの共通形
  const expectSuccess = (res: any, data: unknown): void => {
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data
      })
    )
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService
        },
        {
          provide: AuthService,
          useValue: mockAuthService
        }
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

      const res = mockResponse()
      await controller.create(createUserDto, res)

      expect(service.create).toHaveBeenCalledWith(createUserDto)
      expectSuccess(res, mockUser)
    })
  })

  describe('findOne', () => {
    it('should return a user resolved from the authorization token', async () => {
      mockUserService.findByDiscordId.mockResolvedValue(mockUser)

      const res = mockResponse()
      await controller.findOne('Bearer valid-token', res)

      expect(mockAuthService.validateToken).toHaveBeenCalledWith('Bearer valid-token')
      expect(service.findByDiscordId).toHaveBeenCalledWith('discord123')
      expectSuccess(res, mockUser)
    })

    it('should return 404 when the user is not found', async () => {
      mockUserService.findByDiscordId.mockResolvedValue(null)

      const res = mockResponse()
      await controller.findOne('Bearer valid-token', res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      )
    })
  })

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto: UpdateUserDto = { name: 'Updated Name' }
      const updatedUser = { ...mockUser, name: 'Updated Name' }

      mockUserService.update.mockResolvedValue(updatedUser)

      const res = mockResponse()
      await controller.update({ discordUserId: 'discord123' }, updateUserDto, res)

      expect(service.update).toHaveBeenCalledWith('discord123', updateUserDto)
      expectSuccess(res, updatedUser)
    })
  })

  describe('addCharacter', () => {
    it('should add a character to a user', async () => {
      const updatedUser = { ...mockUser, characterIds: ['character123'] }

      mockUserService.addCharacterId.mockResolvedValue(updatedUser)

      const res = mockResponse()
      await controller.addCharacter({ discordUserId: 'discord123', characterId: 'character123' }, res)

      expect(service.addCharacterId).toHaveBeenCalledWith('discord123', 'character123')
      expectSuccess(res, updatedUser)
    })
  })

  describe('removeCharacter', () => {
    it('should remove a character from a user', async () => {
      const updatedUser = { ...mockUser, characterIds: [] }

      mockUserService.removeCharacterId.mockResolvedValue(updatedUser)

      const res = mockResponse()
      await controller.removeCharacter({ discordUserId: 'discord123', characterId: 'character123' }, res)

      expect(service.removeCharacterId).toHaveBeenCalledWith('discord123', 'character123')
      expectSuccess(res, updatedUser)
    })
  })

  describe('remove', () => {
    it('should remove a user', async () => {
      mockUserService.remove.mockResolvedValue(mockUser)

      const res = mockResponse()
      await controller.remove({ discordUserId: 'discord123' }, res)

      expect(service.remove).toHaveBeenCalledWith('discord123')
      expectSuccess(res, mockUser)
    })
  })
})
