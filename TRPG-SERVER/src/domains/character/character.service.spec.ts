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
 * - 過去形 character.updated / character.deleted は購読者ゼロのデッドイベントとして廃止済み。
 *   update / updateField / remove 等は DB 操作のみを行い、いかなるイベントも emit しない
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
      findByIdForOwner: jest.fn(),
      findByName: jest.fn(),
      findByChannelId: jest.fn(),
      update: jest.fn(),
      updateForOwner: jest.fn(),
      updateByChannelId: jest.fn(),
      updateField: jest.fn(),
      updateFieldByChannelId: jest.fn(),
      remove: jest.fn(),
      removeForOwner: jest.fn(),
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

    it('AttributeValue の values と dice を欠落させず repository へ渡す', async () => {
      characterRepository.create.mockResolvedValue(mockCharacter)
      const skill = {
        目星: {
          name: '目星',
          values: { base: 25, growth: 15 },
          dice: '1d100<=40',
          description: '手掛かりを見つける'
        }
      }

      await service.create({ ...createDto, skill })

      expect(characterRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          skill: {
            目星: {
              name: '目星',
              values: { base: 25, growth: 15 },
              dice: '1d100<=40',
              description: '手掛かりを見つける',
              index: undefined,
              isVisible: undefined
            }
          }
        })
      )
    })

    it('プリミティブ属性を空の AttributeValue へ暗黙変換しない', async () => {
      const invalid = {
        ...createDto,
        parameter: { STR: 50 }
      } as unknown as CharacterInputDto

      await expect(service.create(invalid)).rejects.toThrow(/AttributeSection/)
      expect(characterRepository.create).not.toHaveBeenCalled()
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

  describe('updateField', () => {
    it('should update field via repository and not emit any event', async () => {
      // Given
      characterRepository.updateField.mockResolvedValue(mockCharacter)
      const status = { HP: { values: { base: 100 } } }

      // When
      await service.updateField('test-id', 'status', status)

      // Then - DB 操作のみ。過去形デッドイベントは廃止済みで emit しない
      expect(characterRepository.updateField).toHaveBeenCalledWith('test-id', 'status', status)
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('非正準形をrepositoryへ渡さない', async () => {
      const invalid = { HP: 100 } as unknown as Parameters<CharacterService['updateField']>[2]

      await expect(service.updateField('test-id', 'status', invalid)).rejects.toThrow(/AttributeSection/)
      expect(characterRepository.updateField).not.toHaveBeenCalled()
    })

    it('should not emit when character is not found', async () => {
      // Given
      characterRepository.updateField.mockResolvedValue(null)
      const status = { HP: { values: { base: 100 } } }

      // When
      const result = await service.updateField('missing-id', 'status', status)

      // Then
      expect(typedEventService.emit).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('updateFieldByChannelId', () => {
    it('should update field by channelId via repository and not emit any event', async () => {
      // Given
      characterRepository.updateFieldByChannelId.mockResolvedValue(mockCharacter)
      const parameter = { STR: { values: { base: 15 } } }

      // When
      await service.updateFieldByChannelId('test-channel', 'parameter', parameter)

      // Then - DB 操作のみ。過去形デッドイベントは廃止済みで emit しない
      expect(characterRepository.updateFieldByChannelId).toHaveBeenCalledWith('test-channel', 'parameter', parameter)
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('非正準形をrepositoryへ渡さない', async () => {
      const invalid = { STR: 15 } as unknown as Parameters<CharacterService['updateFieldByChannelId']>[2]

      await expect(service.updateFieldByChannelId('test-channel', 'parameter', invalid)).rejects.toThrow(
        /AttributeSection/
      )
      expect(characterRepository.updateFieldByChannelId).not.toHaveBeenCalled()
    })

    it('should not emit when character is not found', async () => {
      // Given
      characterRepository.updateFieldByChannelId.mockResolvedValue(null)
      const parameter = { STR: { values: { base: 15 } } }

      // When
      const result = await service.updateFieldByChannelId('missing-channel', 'parameter', parameter)

      // Then
      expect(typedEventService.emit).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('should update via repository and not emit any event', async () => {
      // Given
      characterRepository.update.mockResolvedValue(mockCharacter)

      // When
      await service.update('test-id', { characterName: 'Updated' })

      // Then - DB 操作のみ。過去形デッドイベントは廃止済みで emit しない
      expect(characterRepository.update).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({ characterName: 'Updated' })
      )
      expect(typedEventService.emit).not.toHaveBeenCalled()
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

  describe('owner-qualified HTTP operations', () => {
    it('findOneForOwner は所有者条件付きrepository操作へ委譲する', async () => {
      characterRepository.findByIdForOwner.mockResolvedValue(mockCharacter)

      const result = await service.findOneForOwner('test-id', 'test-user')

      expect(characterRepository.findByIdForOwner).toHaveBeenCalledWith('test-id', 'test-user')
      expect(result).toBe(mockCharacter)
    })

    it('updateForOwner は所有者条件付きrepository操作へ変換後データを渡す', async () => {
      characterRepository.updateForOwner.mockResolvedValue(mockCharacter)

      const result = await service.updateForOwner('test-id', 'test-user', { characterName: 'Updated' })

      expect(characterRepository.updateForOwner).toHaveBeenCalledWith('test-id', 'test-user', {
        characterName: 'Updated'
      })
      expect(result).toBe(mockCharacter)
    })

    it('updateForOwner は AttributeValue の dice を保持する', async () => {
      characterRepository.updateForOwner.mockResolvedValue(mockCharacter)

      await service.updateForOwner('test-id', 'test-user', {
        skill: {
          聞き耳: {
            values: { base: 20, growth: 10 },
            dice: '1d100<=30'
          }
        }
      })

      expect(characterRepository.updateForOwner).toHaveBeenCalledWith('test-id', 'test-user', {
        skill: {
          聞き耳: {
            name: undefined,
            index: undefined,
            values: { base: 20, growth: 10 },
            description: undefined,
            dice: '1d100<=30',
            isVisible: undefined
          }
        }
      })
    })

    it('removeForOwner は所有者条件付きrepository操作だけを呼ぶ', async () => {
      characterRepository.removeForOwner.mockResolvedValue(mockCharacter)

      const result = await service.removeForOwner('test-id', 'test-user')

      expect(characterRepository.removeForOwner).toHaveBeenCalledWith('test-id', 'test-user')
      expect(characterRepository.remove).not.toHaveBeenCalled()
      expect(result).toBe(mockCharacter)
    })
  })

  describe('remove', () => {
    it('should delete character directly and not emit any event', async () => {
      // Given
      characterRepository.remove.mockResolvedValue(mockCharacter)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()

      // When
      await service.remove('test-id', 'test-user')

      // Then - DB 削除のみ。過去形デッドイベントは廃止済みで emit しない
      expect(characterRepository.remove).toHaveBeenCalledWith('test-id')
      expect(typedEventService.emit).not.toHaveBeenCalled()
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
    it('should delete character by channel directly and not emit any event', async () => {
      // Given
      characterRepository.removeByChannelId.mockResolvedValue(undefined)
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation()

      // When
      await service.removeByChannelId('test-channel', 'test-user')

      // Then - DB 削除のみ。過去形デッドイベントは廃止済みで emit しない
      expect(characterRepository.removeByChannelId).toHaveBeenCalledWith('test-channel')
      expect(typedEventService.emit).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalledWith('Deleting character by channelId: test-channel')

      logSpy.mockRestore()
    })

    it('should delete via repository even when no character matched, and not emit any event', async () => {
      // Given
      characterRepository.removeByChannelId.mockResolvedValue(undefined)

      // When
      await service.removeByChannelId('missing-channel', 'test-user')

      // Then - 削除自体は実行されるが、イベントは発行されない
      expect(characterRepository.removeByChannelId).toHaveBeenCalledWith('missing-channel')
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })
  })
})
