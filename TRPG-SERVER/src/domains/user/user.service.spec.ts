import { Test, TestingModule } from '@nestjs/testing'
import { UserService } from './user.service'
import { UserRepository } from './repositories/user.repository'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { User } from './models/user.model'

describe('UserService', () => {
  let service: UserService
  let repository: jest.Mocked<UserRepository>

  const mockUser: User = {
    discordUserId: 'test-discord-id',
    name: 'Test User',
    characterIds: []
  }

  beforeEach(async () => {
    // UserRepository用の完全なモックを作成
    const userRepositoryMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findByDiscordId: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addCharacterId: jest.fn(),
      removeCharacterId: jest.fn(),
      updateDiscordTokens: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: userRepositoryMock
        }
      ]
    }).compile()

    service = module.get<UserService>(UserService)
    repository = module.get(UserRepository) as jest.Mocked<UserRepository>
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should create a user', async () => {
      const createUserDto: CreateUserDto = {
        discordUserId: 'test-discord-id',
        name: 'Test User'
      }

      repository.create.mockResolvedValue(mockUser)

      const result = await service.create(createUserDto)

      expect(repository.create).toHaveBeenCalledWith(createUserDto)
      expect(result).toEqual(mockUser)
    })
  })

  describe('findAll', () => {
    it('should return an array of users', async () => {
      repository.findAll.mockResolvedValue([mockUser])

      const result = await service.findAll()

      expect(repository.findAll).toHaveBeenCalled()
      expect(result).toEqual([mockUser])
    })
  })

  describe('findOne', () => {
    it('should return a user by discord ID', async () => {
      repository.findById.mockResolvedValue(mockUser)

      const result = await service.findOne('test-discord-id')

      expect(repository.findById).toHaveBeenCalledWith('test-discord-id')
      expect(result).toEqual(mockUser)
    })

    it('should return null when user not found', async () => {
      repository.findById.mockResolvedValue(null)

      const result = await service.findOne('non-existent-id')

      expect(repository.findById).toHaveBeenCalledWith('non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto: UpdateUserDto = { name: 'Updated Name' }
      const updatedUser = { ...mockUser, name: 'Updated Name' }

      repository.update.mockResolvedValue(updatedUser)

      const result = await service.update('test-discord-id', updateUserDto)

      expect(repository.update).toHaveBeenCalledWith('test-discord-id', updateUserDto)
      expect(result).toEqual(updatedUser)
    })
  })

  describe('addCharacterId', () => {
    it('should add a character ID to user', async () => {
      const characterId = 'test-character-id'
      const updatedUser = {
        ...mockUser,
        characterIds: ['test-character-id']
      }

      repository.addCharacterId.mockResolvedValue(updatedUser)

      const result = await service.addCharacterId('test-discord-id', characterId)

      expect(repository.addCharacterId).toHaveBeenCalledWith('test-discord-id', characterId)
      expect(result).toEqual(updatedUser)
    })
  })

  describe('removeCharacterId', () => {
    it('should remove a character ID from user', async () => {
      const updatedUser = {
        ...mockUser,
        characterIds: []
      }

      repository.removeCharacterId.mockResolvedValue(updatedUser)

      const result = await service.removeCharacterId('test-discord-id', 'test-character-id')

      expect(repository.removeCharacterId).toHaveBeenCalledWith('test-discord-id', 'test-character-id')
      expect(result).toEqual(updatedUser)
    })
  })

  describe('remove', () => {
    it('should remove a user', async () => {
      repository.remove.mockResolvedValue(undefined)

      await service.remove('test-discord-id')

      expect(repository.remove).toHaveBeenCalledWith('test-discord-id')
    })
  })
})
