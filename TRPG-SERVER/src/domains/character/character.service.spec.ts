/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing'
import { CharacterService } from './character.service'
import { CharacterRepository } from './repositories/character.repository'
import { TypedEventService } from '../../core/events/typed-event.service'
import { CharacterInputDto } from './dto/create-character.dto'
import { Character } from './models/character.model'

/**
 * CharacterService ユニットテスト
 *
 * 現行 CharacterService は単純化済み:
 * - feature flag (`prototype.eventDriven`) 分岐は削除（AppConfigService 依存なし）
 * - UserService / DiscordService 依存は削除（単一責任原則の強化）
 * - create は characterId 必須（外部生成想定）。作成完了イベントは別ハンドラが発行するため emit しない
 * - update / updateByChannelId / remove / removeByChannelId が character.updated / character.deleted を emit
 */
describe('CharacterService', () => {
  let service: CharacterService
  let characterRepository: jest.Mocked<CharacterRepository>
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
      updateField: jest.fn(),
      updateFieldByChannelId: jest.fn(),
      remove: jest.fn(),
      removeByChannelId: jest.fn(),
      findUserCharacterSummaries: jest.fn()
    }

    const mockTypedEventService = {
      emit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterService,
        { provide: CharacterRepository, useValue: mockCharacterRepository },
        { provide: TypedEventService, useValue: mockTypedEventService }
      ]
    }).compile()

    service = module.get<CharacterService>(CharacterService)
    characterRepository = module.get(CharacterRepository)
    typedEventService = module.get(TypedEventService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    const createDto: CharacterInputDto = {
      characterId: 'test-id',
      characterName: 'Test Character',
      gameSystemId: 'test-system',
      discordUserId: 'test-user',
      discordChannelId: 'test-channel',
      status: {},
      skill: {},
      parameter: {}
    }

    it('should create character directly via repository', async () => {
      // Given
      characterRepository.create.mockResolvedValue(mockCharacter)

      // When
      const result = await service.create(createDto)

      // Then
      expect(characterRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId: createDto.characterId,
          characterName: createDto.characterName,
          gameSystemId: createDto.gameSystemId,
          discordUserId: createDto.discordUserId,
          discordChannelId: createDto.discordChannelId
        })
      )
      expect(result).toEqual(mockCharacter)
    })

    it('should not emit any event on create (creation event handled by dedicated handler)', async () => {
      // Given
      characterRepository.create.mockResolvedValue(mockCharacter)

      // When
      await service.create(createDto)

      // Then - 作成完了イベントは CharacterCreationRequestedHandler で発行されるため、ここでは発行しない
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('should throw when characterId is not provided', async () => {
      // Given - characterId 未指定の DTO
      const { characterId, ...dtoWithoutId } = createDto

      // When / Then
      await expect(service.create(dtoWithoutId as CharacterInputDto)).rejects.toThrow(
        'CharacterID is required. Use Character Event Handler for automatic ID generation.'
      )
      expect(characterRepository.create).not.toHaveBeenCalled()
    })

    it('should log creation messages', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()
      characterRepository.create.mockResolvedValue(mockCharacter)

      await service.create(createDto)

      expect(logSpy).toHaveBeenCalledWith('Creating character: Test Character')
      expect(logSpy).toHaveBeenCalledWith('Character created successfully: test-id')

      logSpy.mockRestore()
    })
  })

  describe('findByChannelId', () => {
    it('should search character directly via repository', async () => {
      // Given
      characterRepository.findByChannelId.mockResolvedValue(mockCharacter)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()

      // When
      const result = await service.findByChannelId('test-channel')

      // Then
      expect(characterRepository.findByChannelId).toHaveBeenCalledWith('test-channel')
      expect(result).toEqual(mockCharacter)
      expect(logSpy).toHaveBeenCalledWith('Searching character by channelId: test-channel')

      logSpy.mockRestore()
    })
  })

  describe('updateByChannelId', () => {
    const updateData = { characterName: 'Updated Character' }

    it('should update character directly via repository', async () => {
      // Given
      characterRepository.updateByChannelId.mockResolvedValue(mockCharacter)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()

      // When
      const result = await service.updateByChannelId('test-channel', updateData)

      // Then
      expect(characterRepository.updateByChannelId).toHaveBeenCalledWith(
        'test-channel',
        expect.objectContaining({ characterName: 'Updated Character' })
      )
      expect(result).toEqual(mockCharacter)
      expect(logSpy).toHaveBeenCalledWith('Updating character by channelId: test-channel')

      logSpy.mockRestore()
    })

    it('should return null when character is not found', async () => {
      // Given
      characterRepository.updateByChannelId.mockResolvedValue(null)

      // When
      const result = await service.updateByChannelId('missing-channel', updateData)

      // Then
      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('should emit character.updated when update succeeds', async () => {
      // Given
      characterRepository.update.mockResolvedValue(mockCharacter)

      // When
      await service.update('test-id', { characterName: 'Updated' })

      // Then
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.updated',
        expect.objectContaining({
          character: mockCharacter,
          updateType: 'update',
          source: 'character-service'
        })
      )
    })

    it('should not emit when character is not found', async () => {
      // Given
      characterRepository.update.mockResolvedValue(null)

      // When
      const result = await service.update('missing-id', { characterName: 'Updated' })

      // Then
      expect(typedEventService.emit).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('should delete character directly and emit character.deleted', async () => {
      // Given
      characterRepository.remove.mockResolvedValue(mockCharacter)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()

      // When
      await service.remove('test-id', 'test-user')

      // Then
      expect(characterRepository.remove).toHaveBeenCalledWith('test-id')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.deleted',
        expect.objectContaining({
          character: mockCharacter,
          source: 'character-service'
        })
      )
      expect(logSpy).toHaveBeenCalledWith('Deleting character: test-id')

      logSpy.mockRestore()
    })

    it('should not emit when character is not found', async () => {
      // Given
      characterRepository.remove.mockResolvedValue(null)

      // When
      await service.remove('missing-id')

      // Then
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })
  })

  describe('removeByChannelId', () => {
    it('should delete character by channel directly and emit character.deleted', async () => {
      // Given
      characterRepository.findByChannelId.mockResolvedValue(mockCharacter)
      characterRepository.removeByChannelId.mockResolvedValue(undefined)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()

      // When
      await service.removeByChannelId('test-channel', 'test-user')

      // Then
      expect(characterRepository.findByChannelId).toHaveBeenCalledWith('test-channel')
      expect(characterRepository.removeByChannelId).toHaveBeenCalledWith('test-channel')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.deleted',
        expect.objectContaining({
          character: mockCharacter,
          source: 'character-service'
        })
      )
      expect(logSpy).toHaveBeenCalledWith('Deleting character by channelId: test-channel')

      logSpy.mockRestore()
    })

    it('should not emit when character is not found for channel', async () => {
      // Given
      characterRepository.findByChannelId.mockResolvedValue(null)
      characterRepository.removeByChannelId.mockResolvedValue(undefined)

      // When
      await service.removeByChannelId('missing-channel', 'test-user')

      // Then - 削除自体は実行されるが、イベントは発行されない
      expect(characterRepository.removeByChannelId).toHaveBeenCalledWith('missing-channel')
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })
  })
})
