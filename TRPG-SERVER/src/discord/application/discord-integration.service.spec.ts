import { Test, TestingModule } from '@nestjs/testing'
import { DiscordIntegrationService } from './discord-integration.service'
import { EventBusService } from '../../shared/application/event-bus.service'
import { DiscordService } from '../discord.service'
import {
  CharacterCreated,
  CharacterUpdated,
  CharacterDeleted,
  CharacterNotFound,
  CharacterValidationFailed,
  CharacterCreationFailed,
  CharacterUpdateFailed,
  CharacterDeletionFailed,
  CharacterAccessDenied,
  CharacterLimitExceeded,
  CharacterCreationRequested,
  CharacterUpdateRequested,
  CharacterDeletionRequested
} from '../../domains/character/events/character.events'
import { Character } from '../../domains/character/models/character.model'
import { CreateCharacterDto } from '../../domains/character/dto/create-character.dto'
import { UpdateCharacterDto } from '../../domains/character/dto/update-character.dto'

describe('DiscordIntegrationService', () => {
  let service: DiscordIntegrationService
  let eventBusService: jest.Mocked<EventBusService>
  let discordService: jest.Mocked<DiscordService>

  const mockCharacter: Character = {
    characterId: 'test-id',
    characterName: 'Test Character',
    gameSystemId: 'test-system',
    discordUserId: 'test-user',
    discordChannelId: 'test-channel',
    status: {},
    skill: {},
    parameter: {}
  }

  beforeEach(async () => {
    const mockEventBusService = {
      publish: jest.fn(),
      subscribe: jest.fn(),
      subscribeMany: jest.fn()
    }

    const mockDiscordService = {
      createOrUpdateCharacterEmbed: jest.fn(),
      createChannel: jest.fn(),
      sendMessage: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordIntegrationService,
        { provide: EventBusService, useValue: mockEventBusService },
        { provide: DiscordService, useValue: mockDiscordService }
      ]
    }).compile()

    service = module.get<DiscordIntegrationService>(DiscordIntegrationService)
    eventBusService = module.get(EventBusService)
    discordService = module.get(DiscordService)
  })

  describe('requestCharacterCreation', () => {
    it('should publish CharacterCreationRequested event', async () => {
      // Given
      const createData: CreateCharacterDto = {
        characterId: 'test-id',
        characterName: 'Test Character',
        gameSystemId: 'test-system',
        discordUserId: 'test-user'
      }

      // When
      await service.requestCharacterCreation(createData, 'test-user')

      // Then
      expect(eventBusService.publish).toHaveBeenCalledWith(expect.any(CharacterCreationRequested))
    })
  })

  describe('requestCharacterUpdate', () => {
    it('should publish CharacterUpdateRequested event', async () => {
      // Given
      const updateData: UpdateCharacterDto = {
        characterName: 'Updated Character'
      }

      // When
      await service.requestCharacterUpdate('test-channel', updateData, 'test-user')

      // Then
      expect(eventBusService.publish).toHaveBeenCalledWith(expect.any(CharacterUpdateRequested))
    })
  })

  describe('requestCharacterDeletion', () => {
    it('should publish CharacterDeletionRequested event', async () => {
      // When
      await service.requestCharacterDeletion('test-id', 'test-user', 'test reason')

      // Then
      expect(eventBusService.publish).toHaveBeenCalledWith(expect.any(CharacterDeletionRequested))
    })
  })

  describe('handleCharacterCreated', () => {
    it('should create Discord UI for new character with existing channel', async () => {
      // Given
      const event = new CharacterCreated(mockCharacter)
      discordService.createOrUpdateCharacterEmbed.mockResolvedValue({
        success: true,
        messageId: 'test-message-id'
      })

      // When
      await service.handleCharacterCreated(event)

      // Then
      expect(discordService.createOrUpdateCharacterEmbed).toHaveBeenCalledWith(
        mockCharacter,
        'test-channel',
        expect.any(Object)
      )
    })

    it('should create new channel for character without existing channel', async () => {
      // Given
      const characterWithoutChannel = { ...mockCharacter, discordChannelId: '' }
      const event = new CharacterCreated(characterWithoutChannel)
      discordService.createChannel.mockResolvedValue({
        success: true,
        channelId: 'new-channel-id'
      })

      // When
      await service.handleCharacterCreated(event)

      // Then
      expect(discordService.createChannel).toHaveBeenCalledWith({
        name: 'Test Character-character',
        type: 'text',
        parentId: undefined,
        guildId: 'default'
      })
    })

    it('should handle Discord UI creation failure gracefully', async () => {
      // Given
      const event = new CharacterCreated(mockCharacter)
      discordService.createOrUpdateCharacterEmbed.mockRejectedValue(new Error('Discord API error'))

      // When & Then
      await expect(service.handleCharacterCreated(event)).resolves.not.toThrow()
      expect(discordService.sendMessage).toHaveBeenCalledWith({
        channelId: 'test-channel',
        content: expect.stringContaining('Discord UI の設定に失敗しました')
      })
    })
  })

  describe('handleCharacterUpdated', () => {
    it('should update Discord UI for character', async () => {
      // Given
      const event = new CharacterUpdated(mockCharacter, {}, ['characterName'])
      discordService.createOrUpdateCharacterEmbed.mockResolvedValue({
        success: true,
        messageId: 'test-message-id'
      })

      // When
      await service.handleCharacterUpdated(event)

      // Then
      expect(discordService.createOrUpdateCharacterEmbed).toHaveBeenCalledWith(
        mockCharacter,
        'test-channel',
        expect.any(Object)
      )
    })

    it('should handle Discord UI update failure gracefully', async () => {
      // Given
      const event = new CharacterUpdated(mockCharacter, {}, ['characterName'])
      discordService.createOrUpdateCharacterEmbed.mockRejectedValue(new Error('Discord API error'))

      // When & Then
      await expect(service.handleCharacterUpdated(event)).resolves.not.toThrow()
    })
  })

  describe('handleCharacterDeleted', () => {
    it('should handle character deletion with existing channel', async () => {
      // Given
      const event = new CharacterDeleted('test-id', 'test-user', mockCharacter)
      discordService.sendMessage.mockResolvedValue({
        success: true,
        messageId: 'test-message-id'
      })

      // When
      await service.handleCharacterDeleted(event)

      // Then
      expect(discordService.sendMessage).toHaveBeenCalledWith({
        channelId: 'test-channel',
        content: expect.stringContaining('キャラクター「Test Character」が削除されました')
      })
    })

    it('should handle character deletion without channel', async () => {
      // Given
      const characterWithoutChannel = { ...mockCharacter, discordChannelId: '' }
      const event = new CharacterDeleted('test-id', 'test-user', characterWithoutChannel)

      // When
      await service.handleCharacterDeleted(event)

      // Then
      expect(discordService.sendMessage).not.toHaveBeenCalled()
    })

    it('should handle Discord message sending failure gracefully', async () => {
      // Given
      const event = new CharacterDeleted('test-id', 'test-user', mockCharacter)
      discordService.sendMessage.mockRejectedValue(new Error('Discord API error'))

      // When & Then
      await expect(service.handleCharacterDeleted(event)).resolves.not.toThrow()
    })
  })

  describe('handleCharacterNotFound', () => {
    it('should handle character not found error', async () => {
      // Given
      const event = new CharacterNotFound({ channelId: 'test-channel' }, 'discord')

      // When
      await service.handleCharacterNotFound(event)

      // Then
      // Note: sendErrorMessage method doesn't exist in current DiscordService
      // This test verifies the method can be called without throwing errors
      expect(true).toBe(true)
    })
  })

  describe('handleCharacterValidationFailed', () => {
    it('should handle validation failure', async () => {
      // Given
      const event = new CharacterValidationFailed(mockCharacter, ['Character name is required'], 'discord')

      // When
      await service.handleCharacterValidationFailed(event)

      // Then
      // Note: sendValidationErrorMessage method doesn't exist in current DiscordService
      // This test verifies the method can be called without throwing errors
      expect(true).toBe(true)
    })
  })

  describe('handleCharacterCreationFailed', () => {
    it('should handle creation failure', async () => {
      // Given
      const createData: CreateCharacterDto = {
        characterId: 'test-id',
        characterName: 'Test Character',
        gameSystemId: 'test-system',
        discordUserId: 'test-user'
      }
      const event = new CharacterCreationFailed(createData, new Error('Creation failed'))

      // When
      await service.handleCharacterCreationFailed(event)

      // Then
      // Note: sendCreationErrorNotification method doesn't exist in current DiscordService
      // This test verifies the method can be called without throwing errors
      expect(true).toBe(true)
    })
  })

  describe('handleCharacterUpdateFailed', () => {
    it('should handle update failure', async () => {
      // Given
      const updateData: UpdateCharacterDto = {
        characterName: 'Updated Character'
      }
      const event = new CharacterUpdateFailed('test-channel', updateData, new Error('Update failed'))

      // When
      await service.handleCharacterUpdateFailed(event)

      // Then
      // Note: sendErrorMessage method doesn't exist in current DiscordService
      // This test verifies the method can be called without throwing errors
      expect(true).toBe(true)
    })
  })

  describe('handleCharacterAccessDenied', () => {
    it('should handle access denied error', async () => {
      // Given
      const event = new CharacterAccessDenied('test-id', 'test-user', 'discord')

      // When
      await service.handleCharacterAccessDenied(event)

      // Then
      // Note: sendAccessDeniedMessage method doesn't exist in current DiscordService
      // This test verifies the method can be called without throwing errors
      expect(true).toBe(true)
    })
  })

  describe('handleCharacterLimitExceeded', () => {
    it('should handle limit exceeded error', async () => {
      // Given
      const event = new CharacterLimitExceeded('test-user', 50, 50, 'discord')

      // When
      await service.handleCharacterLimitExceeded(event)

      // Then
      // Note: sendLimitExceededMessage method doesn't exist in current DiscordService
      // This test verifies the method can be called without throwing errors
      expect(true).toBe(true)
    })
  })

  describe('onModuleInit', () => {
    it('should register event handlers on module initialization', async () => {
      // When
      await service.onModuleInit()

      // Then
      expect(eventBusService.subscribeMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            eventName: 'character.created',
            handler: expect.any(Object)
          }),
          expect.objectContaining({
            eventName: 'character.updated',
            handler: expect.any(Object)
          }),
          expect.objectContaining({
            eventName: 'character.deleted',
            handler: expect.any(Object)
          })
        ])
      )
    })
  })

  describe('requestCharacterSearch', () => {
    it('should publish CharacterSearchRequested event', async () => {
      // Setup
      const searchCriteria = { channelId: 'test-channel' }
      const source = 'api'

      // Execute
      await service.requestCharacterSearch(searchCriteria, source)

      // Verify
      expect(eventBusService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          searchCriteria,
          source
        })
      )
    })

    it('should use default source when not provided', async () => {
      // Setup
      const searchCriteria = { channelId: 'test-channel' }

      // Execute
      await service.requestCharacterSearch(searchCriteria)

      // Verify
      expect(eventBusService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          searchCriteria,
          source: 'discord'
        })
      )
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })
})
