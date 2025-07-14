import { Test, TestingModule } from '@nestjs/testing'
import { CharacterNameUpdatePrototype } from './character-name-update.prototype'
import { EventBusService } from '../../../../shared/application/event-bus.service'
import { CharacterRepository } from '../../repositories/character.repository'
import {
  CharacterNameUpdateRequestedPrototype,
  CharacterNameUpdatedPrototype,
  CharacterNameUpdateFailedPrototype
} from './character-name-events.prototype'
import { Character } from '../../models/character.model'

describe('CharacterNameUpdatePrototype', () => {
  let service: CharacterNameUpdatePrototype
  let mockCharacterRepository: jest.Mocked<CharacterRepository>
  let mockEventBus: jest.Mocked<EventBusService>

  beforeEach(async () => {
    const mockCharacterRepo = {
      findByChannelId: jest.fn(),
      updateByChannelId: jest.fn()
    }

    const mockEventBusService = {
      publish: jest.fn(),
      subscribe: jest.fn(),
      subscribeMany: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterNameUpdatePrototype,
        { provide: CharacterRepository, useValue: mockCharacterRepo },
        { provide: EventBusService, useValue: mockEventBusService }
      ]
    }).compile()

    service = module.get<CharacterNameUpdatePrototype>(CharacterNameUpdatePrototype)
    mockCharacterRepository = module.get(CharacterRepository)
    mockEventBus = module.get(EventBusService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('requestCharacterNameUpdate', () => {
    it('should publish CharacterNameUpdateRequestedPrototype event for valid input', async () => {
      const channelId = 'test-channel-123'
      const newName = 'New Character Name'
      const userId = 'user-123'

      await service.requestCharacterNameUpdate(channelId, newName, userId)

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId,
          newName,
          userId
        })
      )
    })

    it('should publish failure event for invalid input', async () => {
      const channelId = ''
      const newName = 'New Character Name'
      const userId = 'user-123'

      await service.requestCharacterNameUpdate(channelId, newName, userId)

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'unknown',
          newName,
          errorMessage: 'Invalid input parameters',
          userId
        })
      )
    })

    it('should publish failure event for character name too long', async () => {
      const channelId = 'test-channel-123'
      const newName = 'a'.repeat(101) // 101文字
      const userId = 'user-123'

      await service.requestCharacterNameUpdate(channelId, newName, userId)

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId,
          newName,
          errorMessage: 'Character name must be 100 characters or less',
          userId
        })
      )
    })
  })

  describe('handleCharacterNameUpdateRequest', () => {
    it('should successfully update character name', async () => {
      const mockCharacter: Character = {
        characterId: 'char-123',
        characterName: 'Old Name',
        discordUserId: 'user-123',
        discordChannelId: 'test-channel-123',
        gameSystemId: 'coc',
        status: {},
        skill: {},
        parameter: {},
        item: {},
        description: {}
      }

      const updatedCharacter: Character = {
        ...mockCharacter,
        characterName: 'New Name'
      }

      mockCharacterRepository.findByChannelId.mockResolvedValue(mockCharacter)
      mockCharacterRepository.updateByChannelId.mockResolvedValue(updatedCharacter)

      const event = new CharacterNameUpdateRequestedPrototype('test-channel-123', 'New Name', 'user-123')

      await service.handleCharacterNameUpdateRequest(event)

      expect(mockCharacterRepository.findByChannelId).toHaveBeenCalledWith('test-channel-123')
      expect(mockCharacterRepository.updateByChannelId).toHaveBeenCalledWith('test-channel-123', {
        characterName: 'New Name'
      })
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId: 'char-123',
          oldName: 'Old Name',
          newName: 'New Name',
          channelId: 'test-channel-123'
        })
      )
    })

    it('should publish failure event when character not found', async () => {
      mockCharacterRepository.findByChannelId.mockResolvedValue(null)

      const event = new CharacterNameUpdateRequestedPrototype('test-channel-123', 'New Name', 'user-123')

      await service.handleCharacterNameUpdateRequest(event)

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'test-channel-123',
          newName: 'New Name',
          errorMessage: 'Character not found',
          userId: 'user-123'
        })
      )
    })

    it('should publish failure event for unauthorized access', async () => {
      const mockCharacter: Character = {
        characterId: 'char-123',
        characterName: 'Old Name',
        discordUserId: 'different-user',
        discordChannelId: 'test-channel-123',
        gameSystemId: 'coc',
        status: {},
        skill: {},
        parameter: {},
        item: {},
        description: {}
      }

      mockCharacterRepository.findByChannelId.mockResolvedValue(mockCharacter)

      const event = new CharacterNameUpdateRequestedPrototype('test-channel-123', 'New Name', 'user-123')

      await service.handleCharacterNameUpdateRequest(event)

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'test-channel-123',
          newName: 'New Name',
          errorMessage: 'Unauthorized access',
          userId: 'user-123'
        })
      )
    })

    it('should handle same name gracefully', async () => {
      const mockCharacter: Character = {
        characterId: 'char-123',
        characterName: 'Same Name',
        discordUserId: 'user-123',
        discordChannelId: 'test-channel-123',
        gameSystemId: 'coc',
        status: {},
        skill: {},
        parameter: {},
        item: {},
        description: {}
      }

      mockCharacterRepository.findByChannelId.mockResolvedValue(mockCharacter)

      const event = new CharacterNameUpdateRequestedPrototype('test-channel-123', 'Same Name', 'user-123')

      await service.handleCharacterNameUpdateRequest(event)

      expect(mockCharacterRepository.updateByChannelId).not.toHaveBeenCalled()
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId: 'char-123',
          oldName: 'Same Name',
          newName: 'Same Name',
          channelId: 'test-channel-123'
        })
      )
    })

    it('should handle database update failure', async () => {
      const mockCharacter: Character = {
        characterId: 'char-123',
        characterName: 'Old Name',
        discordUserId: 'user-123',
        discordChannelId: 'test-channel-123',
        gameSystemId: 'coc',
        status: {},
        skill: {},
        parameter: {},
        item: {},
        description: {}
      }

      mockCharacterRepository.findByChannelId.mockResolvedValue(mockCharacter)
      mockCharacterRepository.updateByChannelId.mockResolvedValue(null)

      const event = new CharacterNameUpdateRequestedPrototype('test-channel-123', 'New Name', 'user-123')

      await service.handleCharacterNameUpdateRequest(event)

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'test-channel-123',
          newName: 'New Name',
          errorMessage: 'Database update failed',
          userId: 'user-123'
        })
      )
    })

    it('should handle unexpected errors', async () => {
      const mockError = new Error('Unexpected error')
      mockCharacterRepository.findByChannelId.mockRejectedValue(mockError)

      const event = new CharacterNameUpdateRequestedPrototype('test-channel-123', 'New Name', 'user-123')

      await service.handleCharacterNameUpdateRequest(event)

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'test-channel-123',
          newName: 'New Name',
          errorMessage: 'Unexpected error',
          userId: 'user-123'
        })
      )
    })
  })

  describe('performance test', () => {
    it('should complete name update within reasonable time', async () => {
      const mockCharacter: Character = {
        characterId: 'char-123',
        characterName: 'Old Name',
        discordUserId: 'user-123',
        discordChannelId: 'test-channel-123',
        gameSystemId: 'coc',
        status: {},
        skill: {},
        parameter: {},
        item: {},
        description: {}
      }

      const updatedCharacter: Character = {
        ...mockCharacter,
        characterName: 'New Name'
      }

      mockCharacterRepository.findByChannelId.mockResolvedValue(mockCharacter)
      mockCharacterRepository.updateByChannelId.mockResolvedValue(updatedCharacter)

      const startTime = Date.now()

      const event = new CharacterNameUpdateRequestedPrototype('test-channel-123', 'New Name', 'user-123')

      await service.handleCharacterNameUpdateRequest(event)

      const processingTime = Date.now() - startTime
      expect(processingTime).toBeLessThan(100) // 100ms以内
    })
  })
})
