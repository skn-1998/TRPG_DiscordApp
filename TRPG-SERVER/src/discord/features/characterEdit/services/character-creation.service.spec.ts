import { Test, TestingModule } from '@nestjs/testing'
import { TextChannel } from 'discord.js'
import { CharacterCreationService } from './character-creation.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { ChannelCreationContext } from './channel-detection.service'

describe('CharacterCreationService', () => {
  let service: CharacterCreationService
  let module: TestingModule

  const mockTypedEventService = {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn()
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
          provide: TypedEventService,
          useValue: mockTypedEventService
        }
      ]
    }).compile()

    service = moduleRef.get<CharacterCreationService>(CharacterCreationService)
    module = moduleRef

    // Reset mocks
    jest.clearAllMocks()
    mockTypedEventService.emit.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await module.close()
  })

  describe('createCharacter', () => {
    it('should create character successfully', async () => {
      const result = await service.createCharacter(mockContext)

      expect(result.success).toBe(true)
      expect(result.characterId).toBe('pending')
      expect(result.characterName).toBe('test-character')
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'character.creation.requested',
        expect.objectContaining({
          createData: {
            characterName: 'test-character',
            gameSystemId: '',
            discordUserId: 'test-user-id',
            discordChannelId: 'test-channel-id'
          },
          userId: 'test-user-id',
          source: 'character-creation-service'
        })
      )
    })

    it('should handle character creation errors', async () => {
      mockTypedEventService.emit.mockRejectedValue(new Error('Creation failed'))

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
      expect(mockTypedEventService.emit).toHaveBeenCalledWith(
        'character.creation.requested',
        expect.objectContaining({
          createData: {
            characterName: 'test-character',
            gameSystemId: '',
            discordUserId: '',
            discordChannelId: 'test-channel-id'
          },
          userId: '',
          source: 'character-creation-service'
        })
      )
    })

    it('should handle unknown errors', async () => {
      mockTypedEventService.emit.mockRejectedValue('Unknown error')

      const result = await service.createCharacter(mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })
  })
})
