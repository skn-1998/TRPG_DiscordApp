/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { CharacterService } from './character.service'
import { CharacterRepository } from './repositories/character.repository'
import { UserService } from '../user/user.service'
import { DiscordService } from '../../discord/discord.service'
import { AppConfigService } from '../../config/config.service'
import { TypedEventService } from '../../core/events/typed-event.service'
import { CharacterInputDto } from './dto/create-character.dto'
import { Character } from './models/character.model'

describe('CharacterService', () => {
  let service: CharacterService
  let characterRepository: jest.Mocked<CharacterRepository>
  let userService: jest.Mocked<UserService>
  let discordService: jest.Mocked<DiscordService>
  let configService: jest.Mocked<AppConfigService>
  let typedEventService: jest.Mocked<TypedEventService>

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
    const mockCharacterRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findByChannelId: jest.fn(),
      update: jest.fn(),
      updateByChannelId: jest.fn(),
      remove: jest.fn(),
      removeByChannelId: jest.fn()
    }

    const mockUserService = {
      addCharacterId: jest.fn()
    }

    const mockDiscordService = {
      createOrUpdateCharacterEmbed: jest.fn()
    }

    const mockConfigService = {
      get: jest.fn()
    }

    const mockTypedEventService = {
      emit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterService,
        { provide: CharacterRepository, useValue: mockCharacterRepository },
        { provide: UserService, useValue: mockUserService },
        { provide: DiscordService, useValue: mockDiscordService },
        { provide: AppConfigService, useValue: mockConfigService },
        { provide: TypedEventService, useValue: mockTypedEventService }
      ]
    }).compile()

    service = module.get<CharacterService>(CharacterService)
    characterRepository = module.get(CharacterRepository)
    userService = module.get(UserService)
    discordService = module.get(DiscordService)
    configService = module.get(AppConfigService)
    typedEventService = module.get(TypedEventService)
  })

  describe('create', () => {
    const createDto: CharacterInputDto = {
      characterName: 'Test Character',
      gameSystemId: 'test-system',
      discordUserId: 'test-user',
      discordChannelId: 'test-channel',
      status: {},
      skill: {},
      parameter: {}
    }

    it('should create character using direct method when event-driven is disabled', async () => {
      // Given
      configService.get.mockReturnValue(false) // event-driven disabled
      characterRepository.create.mockResolvedValue(mockCharacter)

      // When
      const result = await service.create(createDto)

      // Then
      expect(configService.get).toHaveBeenCalledWith('prototype.eventDriven')
      expect(characterRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          characterName: createDto.characterName,
          gameSystemId: createDto.gameSystemId,
          discordUserId: createDto.discordUserId,
          discordChannelId: createDto.discordChannelId
        })
      )
      expect(userService.addCharacterId).toHaveBeenCalledWith(createDto.discordUserId, expect.any(String))
      expect(typedEventService.emit).not.toHaveBeenCalled()
      expect(result).toEqual(mockCharacter)
    })

    it('should create character using event-driven method when enabled', async () => {
      // Given
      configService.get.mockReturnValue(true) // event-driven enabled

      // When
      const result = await service.create(createDto)

      // Then
      expect(configService.get).toHaveBeenCalledWith('prototype.eventDriven')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.creation.requested',
        expect.objectContaining({
          type: 'character.creation.requested',
          createData: expect.objectContaining({
            characterName: createDto.characterName,
            gameSystemId: createDto.gameSystemId,
            discordUserId: createDto.discordUserId,
            discordChannelId: createDto.discordChannelId
          }),
          userId: createDto.discordUserId
        })
      )
      expect(characterRepository.create).not.toHaveBeenCalled()
      expect(userService.addCharacterId).not.toHaveBeenCalled()
      expect(result).toEqual(
        expect.objectContaining({
          characterName: createDto.characterName,
          gameSystemId: createDto.gameSystemId,
          discordUserId: createDto.discordUserId,
          discordChannelId: createDto.discordChannelId
        })
      )
    })

    it('should handle missing optional fields in event-driven mode', async () => {
      // Given
      configService.get.mockReturnValue(true)
      const partialDto: CharacterInputDto = {
        characterName: 'Test Character'
      }

      // When
      const result = await service.create(partialDto)

      // Then
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.creation.requested',
        expect.objectContaining({
          type: 'character.creation.requested',
          createData: expect.objectContaining({
            characterName: 'Test Character',
            gameSystemId: '',
            discordUserId: ''
          }),
          userId: ''
        })
      )
      expect(result).toEqual(
        expect.objectContaining({
          characterName: 'Test Character',
          gameSystemId: '',
          discordUserId: ''
        })
      )
    })

    it('should generate characterId when not provided in event-driven mode', async () => {
      // Given
      configService.get.mockReturnValue(true)

      // When
      const result = await service.create(createDto)

      // Then
      expect(result.characterId).toBeDefined()
      expect(result.characterId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('should use provided characterId in event-driven mode', async () => {
      // Given
      configService.get.mockReturnValue(true)
      const dtoWithId = { ...createDto, characterId: 'custom-id' }

      // When
      const result = await service.create(dtoWithId)

      // Then
      expect(result.characterId).toBe('custom-id')
    })

    it('should log appropriate messages for each mode', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()

      // Test direct mode
      configService.get.mockReturnValue(false)
      characterRepository.create.mockResolvedValue(mockCharacter)
      await service.create(createDto)
      expect(logSpy).toHaveBeenCalledWith('[DIRECT] Creating character directly: Test Character')

      // Test event-driven mode
      configService.get.mockReturnValue(true)
      await service.create(createDto)
      expect(logSpy).toHaveBeenCalledWith('[EVENT-DRIVEN] Creating character via events: Test Character')

      logSpy.mockRestore()
    })
  })

  describe('remove', () => {
    it('should delete character using direct method when event-driven is disabled', async () => {
      // Given
      configService.get.mockReturnValue(false) // event-driven disabled

      // When
      await service.remove('test-id', 'test-user')

      // Then
      expect(configService.get).toHaveBeenCalledWith('prototype.eventDriven')
      expect(characterRepository.remove).toHaveBeenCalledWith('test-id')
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('should delete character using direct method when userId is not provided', async () => {
      // Given
      configService.get.mockReturnValue(true) // event-driven enabled but no userId

      // When
      await service.remove('test-id')

      // Then
      expect(characterRepository.remove).toHaveBeenCalledWith('test-id')
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('should delete character using event-driven method when enabled and userId provided', async () => {
      // Given
      configService.get.mockReturnValue(true) // event-driven enabled

      // When
      await service.remove('test-id', 'test-user')

      // Then
      expect(configService.get).toHaveBeenCalledWith('prototype.eventDriven')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.deletion.requested',
        expect.objectContaining({
          type: 'character.deletion.requested',
          characterId: 'test-id',
          userId: 'test-user',
          reason: 'Direct deletion request',
          source: 'api'
        })
      )
      expect(characterRepository.remove).not.toHaveBeenCalled()
    })

    it('should log appropriate messages for each mode', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()

      // Test direct mode
      configService.get.mockReturnValue(false)
      await service.remove('test-id', 'test-user')
      expect(logSpy).toHaveBeenCalledWith('[DIRECT] Deleting character directly: test-id')

      // Test event-driven mode
      configService.get.mockReturnValue(true)
      await service.remove('test-id', 'test-user')
      expect(logSpy).toHaveBeenCalledWith('[EVENT-DRIVEN] Deleting character via events: test-id')

      logSpy.mockRestore()
    })
  })

  describe('removeByChannelId', () => {
    it('should delete character by channel using direct method when event-driven is disabled', async () => {
      // Given
      configService.get.mockReturnValue(false) // event-driven disabled

      // When
      await service.removeByChannelId('test-channel', 'test-user')

      // Then
      expect(configService.get).toHaveBeenCalledWith('prototype.eventDriven')
      expect(characterRepository.removeByChannelId).toHaveBeenCalledWith('test-channel')
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('should delete character by channel using direct method when userId is not provided', async () => {
      // Given
      configService.get.mockReturnValue(true) // event-driven enabled but no userId

      // When
      await service.removeByChannelId('test-channel')

      // Then
      expect(characterRepository.removeByChannelId).toHaveBeenCalledWith('test-channel')
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('should delete character by channel using event-driven method when enabled and userId provided', async () => {
      // Given
      configService.get.mockReturnValue(true) // event-driven enabled
      characterRepository.findByChannelId.mockResolvedValue(mockCharacter)

      // When
      await service.removeByChannelId('test-channel', 'test-user')

      // Then
      expect(configService.get).toHaveBeenCalledWith('prototype.eventDriven')
      expect(characterRepository.findByChannelId).toHaveBeenCalledWith('test-channel')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.deletion.requested',
        expect.objectContaining({
          type: 'character.deletion.requested',
          characterId: 'test-id',
          userId: 'test-user',
          reason: 'Channel-based deletion request',
          source: 'api'
        })
      )
      expect(characterRepository.removeByChannelId).not.toHaveBeenCalled()
    })

    it('should handle character not found in event-driven mode', async () => {
      // Given
      configService.get.mockReturnValue(true) // event-driven enabled
      characterRepository.findByChannelId.mockResolvedValue(null)
      const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation()

      // When
      await service.removeByChannelId('test-channel', 'test-user')

      // Then
      expect(characterRepository.findByChannelId).toHaveBeenCalledWith('test-channel')
      expect(logSpy).toHaveBeenCalledWith('[EVENT-DRIVEN] Character not found for channel: test-channel')
      expect(typedEventService.emit).not.toHaveBeenCalled()

      logSpy.mockRestore()
    })

    it('should log appropriate messages for each mode', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()

      // Test direct mode
      configService.get.mockReturnValue(false)
      await service.removeByChannelId('test-channel', 'test-user')
      expect(logSpy).toHaveBeenCalledWith('[DIRECT] Deleting character by channel directly: test-channel')

      // Test event-driven mode
      configService.get.mockReturnValue(true)
      characterRepository.findByChannelId.mockResolvedValue(mockCharacter)
      await service.removeByChannelId('test-channel', 'test-user')
      expect(logSpy).toHaveBeenCalledWith('[EVENT-DRIVEN] Deleting character by channel via events: test-channel')

      logSpy.mockRestore()
    })
  })

  describe('Character Search Feature Flag', () => {
    it('should use event-driven approach when feature flag is enabled', async () => {
      // Setup
      configService.get.mockReturnValue(true)
      // Mock setup for event-driven search

      const logSpy = jest.spyOn(service['logger'], 'log')

      // Mock the waitForCharacterSearchResult method
      const waitForSearchResultSpy = jest.spyOn(service as any, 'waitForCharacterSearchResult')
      waitForSearchResultSpy.mockResolvedValue(mockCharacter)

      // Execute
      await service.findByChannelId('test-channel')

      // Verify
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.findByChannelId.requested',
        expect.objectContaining({
          type: 'character.findByChannelId.requested',
          channelId: 'test-channel',
          source: 'api'
        })
      )
      expect(logSpy).toHaveBeenCalledWith('[EVENT-DRIVEN] Searching character via events: test-channel')

      logSpy.mockRestore()
      waitForSearchResultSpy.mockRestore()
    })

    it('should use direct approach when feature flag is disabled', async () => {
      // Setup
      configService.get.mockReturnValue(false)
      characterRepository.findByChannelId.mockResolvedValue(mockCharacter)

      const logSpy = jest.spyOn(service['logger'], 'log')

      // Execute
      const result = await service.findByChannelId('test-channel')

      // Verify
      expect(characterRepository.findByChannelId).toHaveBeenCalledWith('test-channel')
      expect(result).toEqual(mockCharacter)
      expect(logSpy).toHaveBeenCalledWith('[DIRECT] Searching character directly: test-channel')

      logSpy.mockRestore()
    })
  })

  describe('Character Update Feature Flag', () => {
    const updateData = { characterName: 'Updated Character' }

    it('should use event-driven approach when feature flag is enabled', async () => {
      // Setup
      configService.get.mockReturnValue(true)
      // Mock setup for event-driven update

      const logSpy = jest.spyOn(service['logger'], 'log')

      // Mock the waitForCharacterUpdateResult method
      const waitForUpdateResultSpy = jest.spyOn(service as any, 'waitForCharacterUpdateResult')
      waitForUpdateResultSpy.mockResolvedValue(mockCharacter)

      // Execute
      await service.updateByChannelId('test-channel', updateData)

      // Verify
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.update.requested',
        expect.objectContaining({
          type: 'character.update.requested',
          channelId: 'test-channel',
          updateData
        })
      )
      expect(logSpy).toHaveBeenCalledWith('[EVENT-DRIVEN] Updating character via events: test-channel')

      logSpy.mockRestore()
      waitForUpdateResultSpy.mockRestore()
    })

    it('should use direct approach when feature flag is disabled', async () => {
      // Setup
      configService.get.mockReturnValue(false)
      characterRepository.updateByChannelId.mockResolvedValue(mockCharacter)
      discordService.createOrUpdateCharacterEmbed.mockResolvedValue({ success: true })

      const logSpy = jest.spyOn(service['logger'], 'log')

      // Execute
      const result = await service.updateByChannelId('test-channel', updateData)

      // Verify
      expect(characterRepository.updateByChannelId).toHaveBeenCalledWith('test-channel', updateData)
      expect(result).toEqual(mockCharacter)
      expect(logSpy).toHaveBeenCalledWith('[DIRECT] Updating character directly: test-channel')

      logSpy.mockRestore()
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })
})
