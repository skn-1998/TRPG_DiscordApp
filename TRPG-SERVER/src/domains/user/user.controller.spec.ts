import { Test, TestingModule } from '@nestjs/testing'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { NotFoundException } from '@nestjs/common'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

describe('UserController', () => {
  let controller: UserController
  let service: UserService

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService
        }
      ]
    }).compile()

    controller = module.get<UserController>(UserController)
    service = module.get<UserService>(UserService)
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

      expect(await controller.create(createUserDto)).toEqual(mockUser)
      expect(service.create).toHaveBeenCalledWith(createUserDto)
    })
  })

  describe('findAll', () => {
    it('should return an array of users', async () => {
      mockUserService.findAll.mockResolvedValue([mockUser])

      expect(await controller.findAll()).toEqual([mockUser])
      expect(service.findAll).toHaveBeenCalled()
    })
  })

  describe('findOne', () => {
    it('should return a user by Discord ID', async () => {
      mockUserService.findByDiscordId.mockResolvedValue(mockUser)

      expect(await controller.findOne('discord123')).toEqual(mockUser)
      expect(service.findByDiscordId).toHaveBeenCalledWith('discord123')
    })
  })

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto: UpdateUserDto = { name: 'Updated Name' }
      const updatedUser = { ...mockUser, name: 'Updated Name' }

      mockUserService.update.mockResolvedValue(updatedUser)

      expect(await controller.update('discord123', updateUserDto)).toEqual(updatedUser)
      expect(service.update).toHaveBeenCalledWith('discord123', updateUserDto)
    })
  })

  describe('addCharacter', () => {
    it('should add a character to a user', async () => {
      const updatedUser = { ...mockUser, characterIds: ['character123'] }

      mockUserService.addCharacterId.mockResolvedValue(updatedUser)

      expect(await controller.addCharacter('discord123', 'character123')).toEqual(updatedUser)
      expect(service.addCharacterId).toHaveBeenCalledWith('discord123', 'character123')
    })
  })

  describe('removeCharacter', () => {
    it('should remove a character from a user', async () => {
      const updatedUser = { ...mockUser, characterIds: [] }

      mockUserService.removeCharacterId.mockResolvedValue(updatedUser)

      expect(await controller.removeCharacter('discord123', 'character123')).toEqual(updatedUser)
      expect(service.removeCharacterId).toHaveBeenCalledWith('discord123', 'character123')
    })
  })

  describe('remove', () => {
    it('should remove a user', async () => {
      mockUserService.remove.mockResolvedValue(mockUser)

      expect(await controller.remove('discord123')).toEqual(mockUser)
      expect(service.remove).toHaveBeenCalledWith('discord123')
    })
  })
})
