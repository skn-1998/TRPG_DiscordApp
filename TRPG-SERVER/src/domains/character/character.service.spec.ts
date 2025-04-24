import { Test, TestingModule } from '@nestjs/testing'
import { CharacterService } from './character.service'
import { CharacterRepository } from './repositories/character.repository'
import { RepositoryMockFactory } from '../../core/testing/repository.mock.factory'
import { CreateCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { Character } from './models/character.model'

// uuidモックを設定
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid')
}))

describe('CharacterService', () => {
  let service: CharacterService
  let repository: jest.Mocked<CharacterRepository>

  const mockCharacter: Character = {
    characterId: 'test-character-id',
    characterName: 'Test Character',
    TRPGName: 'Test TRPG',
    discordUserId: 'test-discord-id',
    discordChannelId: 'test-channel-id',
    status: {},
    skill: {},
    parameter: {}
  }

  beforeEach(async () => {
    // リポジトリのモックを作成
    repository = RepositoryMockFactory.createMock() as jest.Mocked<CharacterRepository>

    // カスタムメソッドのモックを追加
    repository.findByUserId = jest.fn()
    repository.updateField = jest.fn()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterService,
        {
          provide: CharacterRepository,
          useValue: repository
        }
      ]
    }).compile()

    service = module.get<CharacterService>(CharacterService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should create a character', async () => {
      const createCharacterDto: CreateCharacterDto = {
        TRPGName: 'Test TRPG',
        characterName: 'Test Character',
        discordUserId: 'test-discord-id',
        discordChannelId: 'test-channel-id',
        characterId: '',
        status: {},
        parameter: {},
        skill: {}
      }

      const expectedCharacter = {
        characterId: 'test-uuid',
        TRPGName: 'Test TRPG',
        characterName: 'Test Character',
        discordUserId: 'test-discord-id',
        discordChannelId: 'test-channel-id',
        status: {},
        skill: {},
        parameter: {}
      }

      repository.create.mockResolvedValue(expectedCharacter as Character)

      const result = await service.create(createCharacterDto)

      expect(repository.create).toHaveBeenCalledWith(expectedCharacter)
      expect(result).toEqual(expectedCharacter)
    })
  })

  describe('findHavingAll', () => {
    it('should return characters for a user', async () => {
      repository.findByUserId.mockResolvedValue([mockCharacter])

      const result = await service.findHavingAll('test-discord-id')

      expect(repository.findByUserId).toHaveBeenCalledWith('test-discord-id')
      expect(result).toEqual([mockCharacter])
    })
  })

  describe('findOne', () => {
    it('should return a character by ID', async () => {
      repository.findById.mockResolvedValue(mockCharacter)

      const result = await service.findOne('test-character-id')

      expect(repository.findById).toHaveBeenCalledWith('test-character-id')
      expect(result).toEqual(mockCharacter)
    })

    it('should return null when character not found', async () => {
      repository.findById.mockResolvedValue(null)

      const result = await service.findOne('non-existent-id')

      expect(repository.findById).toHaveBeenCalledWith('non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('should update a character', async () => {
      const updateCharacterDto: UpdateCharacterDto = { characterName: 'Updated Character' }
      const updatedCharacter = { ...mockCharacter, characterName: 'Updated Character' }

      repository.update.mockResolvedValue(updatedCharacter)

      const result = await service.update('test-character-id', updateCharacterDto)

      expect(repository.update).toHaveBeenCalledWith('test-character-id', updateCharacterDto)
      expect(result).toEqual(updatedCharacter)
    })
  })

  describe('updateField', () => {
    it('should update a specific field', async () => {
      const field = 'status'
      const data = { hp: 100, mp: 50 }
      const updatedCharacter = {
        ...mockCharacter,
        status: { hp: 100, mp: 50 }
      }

      repository.updateField.mockResolvedValue(updatedCharacter)

      const result = await service.updateField('test-character-id', field, data)

      expect(repository.updateField).toHaveBeenCalledWith('test-character-id', field, data)
      expect(result).toEqual(updatedCharacter)
    })
  })

  describe('remove', () => {
    it('should remove a character', async () => {
      repository.remove.mockResolvedValue(undefined)

      await service.remove('test-character-id')

      expect(repository.remove).toHaveBeenCalledWith('test-character-id')
    })
  })
})
