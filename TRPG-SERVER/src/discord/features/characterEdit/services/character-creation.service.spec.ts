import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { CharacterCreationService } from './character-creation.service'
import { CharacterService } from 'src/domains/character/character.service'
import { ChannelCreationContext } from './channel-detection.service'

describe('CharacterCreationService', () => {
  let service: CharacterCreationService
  let module: TestingModule

  const mockCharacterService = {
    create: jest.fn()
  }

  const mockTextChannel = {
    id: 'test-channel-id',
    name: 'test-character'
  } as unknown as TextChannel

  const mockContext: ChannelCreationContext = {
    channel: mockTextChannel,
    categoryId: 'test-category-id',
    creatorId: 'test-user-id'
  }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterCreationService,
        {
          provide: CharacterService,
          useValue: mockCharacterService
        }
      ]
    }).compile()

    service = moduleRef.get<CharacterCreationService>(CharacterCreationService)
    module = moduleRef

    // Reset mocks
    jest.clearAllMocks()
    mockCharacterService.create.mockResolvedValue({
      characterId: 'test-character-id',
      characterName: 'test-character'
    })
  })

  afterEach(async () => {
    await module.close()
  })

  describe('createCharacter', () => {
    it('should create character successfully', async () => {
      const result = await service.createCharacter(mockContext)

      expect(result.success).toBe(true)
      expect(result.characterId).toBe('test-character-id')
      expect(result.characterName).toBe('test-character')
      expect(mockCharacterService.create).toHaveBeenCalledWith({
        gameSystemId: '',
        characterName: 'test-character',
        discordChannelId: 'test-channel-id',
        discordUserId: 'test-user-id'
      })
    })

    it('should handle character creation errors', async () => {
      mockCharacterService.create.mockRejectedValue(new Error('Creation failed'))

      const result = await service.createCharacter(mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Creation failed')
    })

    it('should handle null creator ID', async () => {
      const contextWithNullCreator = {
        ...mockContext,
        creatorId: null
      }

      const result = await service.createCharacter(contextWithNullCreator)

      expect(result.success).toBe(true)
      expect(mockCharacterService.create).toHaveBeenCalledWith({
        gameSystemId: '',
        characterName: 'test-character',
        discordChannelId: 'test-channel-id',
        discordUserId: ''
      })
    })

    it('should handle unknown errors', async () => {
      mockCharacterService.create.mockRejectedValue('Unknown error')

      const result = await service.createCharacter(mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })
  })
})
