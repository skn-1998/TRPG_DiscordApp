import { Test, TestingModule } from '@nestjs/testing'
import { CharacterIdService } from './character-id.service'
import { CharacterRepository } from '../repositories/character.repository'

describe('CharacterIdService', () => {
  let service: CharacterIdService
  let characterRepository: jest.Mocked<CharacterRepository>

  beforeEach(async () => {
    const mockCharacterRepository = {
      existsById: jest.fn(),
      existsByIdAndChannel: jest.fn(),
      existsByNameAndChannel: jest.fn(),
      existsByNameAndUser: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterIdService,
        {
          provide: CharacterRepository,
          useValue: mockCharacterRepository
        }
      ]
    }).compile()

    service = module.get<CharacterIdService>(CharacterIdService)
    characterRepository = module.get(CharacterRepository)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('generateUniqueCharacterId', () => {
    it('should generate unique character ID on first attempt', async () => {
      characterRepository.existsById.mockResolvedValue(false)

      const id = await service.generateUniqueCharacterId('char_')

      expect(id.startsWith('char_')).toBe(true)
      expect(id).toHaveLength(13) // 'char_' (5) + 8
      expect(characterRepository.existsById).toHaveBeenCalledWith(id)
    })

    it('should retry when ID collision occurs', async () => {
      characterRepository.existsById
        .mockResolvedValueOnce(true) // First attempt: collision
        .mockResolvedValueOnce(false) // Second attempt: success

      const id = await service.generateUniqueCharacterId('char_')

      expect(id.startsWith('char_')).toBe(true)
      expect(characterRepository.existsById).toHaveBeenCalledTimes(2)
    })

    it('should use fallback ID generation after max attempts', async () => {
      // Mock all attempts to return collision
      characterRepository.existsById.mockResolvedValue(true)

      const id = await service.generateUniqueCharacterId('char_', 2)

      expect(id.startsWith('char_')).toBe(true)
      // Should have tried 2 times + 1 fallback attempt
      expect(characterRepository.existsById).toHaveBeenCalledTimes(3)
    })

    it('should use timestamp-based ID as final fallback', async () => {
      // Mock all attempts including fallback to return collision
      characterRepository.existsById.mockResolvedValue(true)

      const id = await service.generateUniqueCharacterId('char_', 1)

      expect(id.startsWith('char_')).toBe(true)
      expect(id).toContain('_') // Timestamp-based ID contains underscore
    })
  })

  describe('generateUniqueCharacterIdInChannel', () => {
    it('should generate unique character ID in specific channel', async () => {
      const channelId = 'test-channel-123'
      characterRepository.existsByIdAndChannel.mockResolvedValue(false)

      const id = await service.generateUniqueCharacterIdInChannel(channelId, 'char_')

      expect(id.startsWith('char_')).toBe(true)
      expect(characterRepository.existsByIdAndChannel).toHaveBeenCalledWith(id, channelId)
    })

    it('should retry when channel-specific ID collision occurs', async () => {
      const channelId = 'test-channel-123'
      characterRepository.existsByIdAndChannel
        .mockResolvedValueOnce(true) // First attempt: collision
        .mockResolvedValueOnce(false) // Second attempt: success

      const id = await service.generateUniqueCharacterIdInChannel(channelId, 'char_')

      expect(id.startsWith('char_')).toBe(true)
      expect(characterRepository.existsByIdAndChannel).toHaveBeenCalledTimes(2)
    })
  })

  describe('generateReadableCharacterId', () => {
    it('should generate readable character ID', async () => {
      characterRepository.existsById.mockResolvedValue(false)

      const id = await service.generateReadableCharacterId('char_')

      expect(id.startsWith('char_')).toBe(true)
      expect(id).not.toContain('0')
      expect(id).not.toContain('O')
      expect(id).not.toContain('I')
      expect(id).not.toContain('l')
      expect(id).not.toContain('1')
    })
  })

  describe('generateSecureCharacterId', () => {
    it('should generate secure character ID', async () => {
      characterRepository.existsById.mockResolvedValue(false)

      const id = await service.generateSecureCharacterId('char_')

      expect(id.startsWith('char_')).toBe(true)
      expect(id).toHaveLength(21) // 'char_' (5) + 16
    })

    it('should use UUID fallback for secure ID collision', async () => {
      characterRepository.existsById.mockResolvedValue(true)

      const id = await service.generateSecureCharacterId('char_')

      expect(id.startsWith('char_')).toBe(true)
      expect(id).toMatch(/^char_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
  })

  describe('isCharacterNameDuplicate', () => {
    it('should check character name duplicate in channel', async () => {
      const characterName = 'Test Character'
      const channelId = 'test-channel-123'
      characterRepository.existsByNameAndChannel.mockResolvedValue(true)

      const isDuplicate = await service.isCharacterNameDuplicate(characterName, channelId)

      expect(isDuplicate).toBe(true)
      expect(characterRepository.existsByNameAndChannel).toHaveBeenCalledWith(characterName, channelId)
    })

    it('should check character name duplicate by user', async () => {
      const characterName = 'Test Character'
      const discordUserId = 'user-123'
      characterRepository.existsByNameAndUser.mockResolvedValue(false)

      const isDuplicate = await service.isCharacterNameDuplicate(characterName, undefined, discordUserId)

      expect(isDuplicate).toBe(false)
      expect(characterRepository.existsByNameAndUser).toHaveBeenCalledWith(characterName, discordUserId)
    })

    it('should check global character name duplicate when no specific context', async () => {
      const characterName = 'Test Character'
      characterRepository.findByName.mockResolvedValue(null)

      const isDuplicate = await service.isCharacterNameDuplicate(characterName)

      expect(isDuplicate).toBe(false)
      expect(characterRepository.findByName).toHaveBeenCalledWith(characterName)
    })
  })

  describe('getIdGenerationStats', () => {
    it('should return ID generation statistics', async () => {
      const mockCharacters = [
        { characterId: 'char_abc123de' },
        { characterId: 'char_xyz789fg' },
        { characterId: 'test_hij456kl' }
      ]
      characterRepository.findAll.mockResolvedValue(mockCharacters as any)

      const stats = await service.getIdGenerationStats()

      expect(stats.totalCharacters).toBe(3)
      expect(stats.averageIdLength).toBe(12) // All IDs are 12 characters
      expect(stats.prefixDistribution).toEqual({
        char_: 2,
        test_: 1
      })
    })

    it('should handle empty character collection', async () => {
      characterRepository.findAll.mockResolvedValue([])

      const stats = await service.getIdGenerationStats()

      expect(stats.totalCharacters).toBe(0)
      expect(stats.averageIdLength).toBe(0)
      expect(stats.prefixDistribution).toEqual({})
    })
  })
})
