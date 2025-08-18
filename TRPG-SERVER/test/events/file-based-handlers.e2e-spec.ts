import { Test, TestingModule } from '@nestjs/testing'
import { TypedEventService } from '../../src/shared/application/typed-event.service'
import { EventRegistryService } from '../../src/events/event-registry.service'
import { CharacterService } from '../../src/domains/character/character.service'
import { CharacterCreationRequestedHandler } from '../../src/events/handlers/character.creation.requested'
import { CharacterUpdateRequestedHandler } from '../../src/events/handlers/character.update.requested'
import { CharacterFindByChannelIdRequestedHandler } from '../../src/events/handlers/character.findByChannelId.requested'
import { CharacterFindByIdRequestedHandler } from '../../src/events/handlers/character.findById.requested'
import {
  CharacterCreationRequestedEvent,
  CharacterUpdateRequestedEvent,
  CharacterFindByChannelIdRequestedEvent,
  CharacterFindByIdRequestedEvent
} from '../../src/events/contracts/unified-event-contracts'

/**
 * File-based Event Handlers E2E Test
 *
 * 🎯 テスト目的:
 * - File-based Event Handlersの統合テスト
 * - 自動登録システムの動作確認
 * - エンドツーエンドのイベントフロー検証
 */
describe('File-based Event Handlers E2E', () => {
  let module: TestingModule
  let typedEventService: TypedEventService
  let eventRegistry: EventRegistryService
  let characterService: CharacterService

  // Mock Data
  const mockCharacterData = {
    characterName: 'Test Character',
    gameSystemId: 'coc',
    discordChannelId: '123456789012345678',
    discordUserId: '987654321098765432',
    parameter: {
      STR: 50,
      CON: 60,
      POW: 70,
      DEX: 55,
      APP: 65,
      SIZ: 50,
      INT: 75,
      EDU: 80
    }
  }

  const mockCharacter = {
    characterId: 'char_test123',
    ...mockCharacterData,
    status: {},
    skill: {},
    item: {},
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(async () => {
    // Create mock CharacterService
    const mockCharacterService = {
      create: jest.fn().mockResolvedValue(mockCharacter),
      findOne: jest.fn().mockResolvedValue(mockCharacter),
      findByChannelId: jest.fn().mockResolvedValue(mockCharacter),
      update: jest.fn().mockResolvedValue(mockCharacter),
      updateByChannelId: jest.fn().mockResolvedValue(mockCharacter)
    }

    module = await Test.createTestingModule({
      providers: [
        TypedEventService,
        EventRegistryService,
        CharacterCreationRequestedHandler,
        CharacterUpdateRequestedHandler,
        CharacterFindByChannelIdRequestedHandler,
        CharacterFindByIdRequestedHandler,
        {
          provide: CharacterService,
          useValue: mockCharacterService
        }
      ]
    }).compile()

    typedEventService = module.get<TypedEventService>(TypedEventService)
    eventRegistry = module.get<EventRegistryService>(EventRegistryService)
    characterService = module.get<CharacterService>(CharacterService)

    // Initialize registry
    await eventRegistry.onModuleInit()
  })

  afterEach(async () => {
    await module.close()
  })

  describe('Event Registry', () => {
    it('should register all handlers automatically', () => {
      const registeredEvents = eventRegistry.getRegisteredEventNames()

      expect(registeredEvents).toContain('character.creation.requested')
      expect(registeredEvents).toContain('character.update.requested')
      expect(registeredEvents).toContain('character.findByChannelId.requested')
      expect(registeredEvents).toContain('character.findById.requested')
      expect(registeredEvents).toHaveLength(4)
    })

    it('should provide handler lookup functionality', () => {
      const handler = eventRegistry.getHandler('character.creation.requested')
      expect(handler).toBeInstanceOf(CharacterCreationRequestedHandler)
    })

    it('should track event statistics', () => {
      const stats = eventRegistry.getEventStatistics()
      expect(stats).toBeInstanceOf(Map)
      expect(stats.size).toBe(4)
    })

    it('should provide health reports', () => {
      const healthReport = eventRegistry.getHealthReport()

      expect(healthReport).toHaveProperty('totalHandlers', 4)
      expect(healthReport).toHaveProperty('totalExecutions', 0)
      expect(healthReport).toHaveProperty('totalErrors', 0)
      expect(healthReport).toHaveProperty('errorRate', 0)
      expect(healthReport).toHaveProperty('healthStatus', 'healthy')
    })
  })

  describe('Character Creation Flow', () => {
    it('should handle character.creation.requested event successfully', async () => {
      const createEvent: CharacterCreationRequestedEvent = {
        type: 'character.creation.requested',
        createData: mockCharacterData,
        source: 'test',
        timestamp: new Date(),
        correlationId: 'test-123'
      }

      // Setup success event listener
      let successEvent: any = null
      typedEventService.on('character.creation.completed', (event) => {
        successEvent = event
      })

      // Emit creation request
      await typedEventService.emit('character.creation.requested', createEvent)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify character service was called
      expect(characterService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockCharacterData,
          characterId: expect.any(String)
        })
      )

      // Verify success event was emitted
      expect(successEvent).toBeTruthy()
      expect(successEvent.character).toEqual(mockCharacter)
    })

    it('should handle validation errors gracefully', async () => {
      const invalidEvent: CharacterCreationRequestedEvent = {
        type: 'character.creation.requested',
        createData: {
          characterName: '', // Invalid: empty name
          gameSystemId: 'coc'
        } as any,
        source: 'test',
        timestamp: new Date()
      }

      // Setup failure event listener
      let failureEvent: any = null
      typedEventService.on('character.creation.failed', (event) => {
        failureEvent = event
      })

      // Emit invalid creation request
      await typedEventService.emit('character.creation.requested', invalidEvent)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify failure event was emitted
      expect(failureEvent).toBeTruthy()
      expect(failureEvent.error.message).toContain('characterName')
    })
  })

  describe('Character Update Flow', () => {
    it('should handle character.update.requested event successfully', async () => {
      const updateEvent: CharacterUpdateRequestedEvent = {
        type: 'character.update.requested',
        characterId: 'char_test123',
        updateData: {
          characterName: 'Updated Character'
        },
        source: 'test',
        timestamp: new Date()
      }

      // Setup success event listener
      let successEvent: any = null
      typedEventService.on('character.update.completed', (event) => {
        successEvent = event
      })

      // Emit update request
      await typedEventService.emit('character.update.requested', updateEvent)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify character service was called
      expect(characterService.findOne).toHaveBeenCalledWith('char_test123')
      expect(characterService.update).toHaveBeenCalledWith(
        'char_test123',
        expect.objectContaining({
          characterName: 'Updated Character'
        })
      )

      // Verify success event was emitted
      expect(successEvent).toBeTruthy()
      expect(successEvent.character).toEqual(mockCharacter)
    })
  })

  describe('Character Search Flow', () => {
    it('should handle character.findByChannelId.requested event successfully', async () => {
      const searchEvent: CharacterFindByChannelIdRequestedEvent = {
        type: 'character.findByChannelId.requested',
        channelId: '123456789012345678',
        source: 'test',
        timestamp: new Date()
      }

      // Setup success event listener
      let successEvent: any = null
      typedEventService.on('character.findByChannelId.completed', (event) => {
        successEvent = event
      })

      // Emit search request
      await typedEventService.emit('character.findByChannelId.requested', searchEvent)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify character service was called
      expect(characterService.findByChannelId).toHaveBeenCalledWith('123456789012345678')

      // Verify success event was emitted
      expect(successEvent).toBeTruthy()
      expect(successEvent.character).toEqual(mockCharacter)
    })

    it('should handle character.findById.requested event successfully', async () => {
      const searchEvent: CharacterFindByIdRequestedEvent = {
        type: 'character.findById.requested',
        characterId: 'char_test123',
        source: 'test',
        timestamp: new Date()
      }

      // Setup success event listener
      let successEvent: any = null
      typedEventService.on('character.findById.completed', (event) => {
        successEvent = event
      })

      // Emit search request
      await typedEventService.emit('character.findById.requested', searchEvent)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify character service was called
      expect(characterService.findOne).toHaveBeenCalledWith('char_test123')

      // Verify success event was emitted
      expect(successEvent).toBeTruthy()
      expect(successEvent.character).toEqual(mockCharacter)
    })

    it('should handle not found cases gracefully', async () => {
      // Mock not found scenario
      jest.spyOn(characterService, 'findByChannelId').mockResolvedValue(null)

      const searchEvent: CharacterFindByChannelIdRequestedEvent = {
        type: 'character.findByChannelId.requested',
        channelId: '999999999999999999',
        source: 'test',
        timestamp: new Date()
      }

      // Setup success event listener
      let successEvent: any = null
      typedEventService.on('character.findByChannelId.completed', (event) => {
        successEvent = event
      })

      // Emit search request
      await typedEventService.emit('character.findByChannelId.requested', searchEvent)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify success event was emitted with null character
      expect(successEvent).toBeTruthy()
      expect(successEvent.character).toBeNull()
    })
  })

  describe('Error Handling & Resilience', () => {
    it('should track execution statistics correctly', async () => {
      const createEvent: CharacterCreationRequestedEvent = {
        type: 'character.creation.requested',
        createData: mockCharacterData,
        source: 'test',
        timestamp: new Date()
      }

      // Emit multiple events
      await typedEventService.emit('character.creation.requested', createEvent)
      await typedEventService.emit('character.creation.requested', createEvent)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Check statistics
      const stats = eventRegistry.getEventStatistics('character.creation.requested')
      expect(stats?.totalExecutions).toBeGreaterThan(0)
      expect(stats?.successCount).toBeGreaterThan(0)
    })

    it('should handle service errors gracefully', async () => {
      // Mock service error
      jest.spyOn(characterService, 'create').mockRejectedValue(new Error('Database connection failed'))

      const createEvent: CharacterCreationRequestedEvent = {
        type: 'character.creation.requested',
        createData: mockCharacterData,
        source: 'test',
        timestamp: new Date()
      }

      // Setup failure event listener
      let failureEvent: any = null
      typedEventService.on('character.creation.failed', (event) => {
        failureEvent = event
      })

      // Emit creation request
      await typedEventService.emit('character.creation.requested', createEvent)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify failure event was emitted
      expect(failureEvent).toBeTruthy()
      expect(failureEvent.error.message).toContain('Database connection failed')
    })
  })
})
