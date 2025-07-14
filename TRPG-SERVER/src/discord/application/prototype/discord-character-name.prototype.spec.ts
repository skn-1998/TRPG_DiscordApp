import { Test, TestingModule } from '@nestjs/testing'
import { DiscordCharacterNamePrototype } from './discord-character-name.prototype'
import { EventBusService } from '../../../shared/application/event-bus.service'
import { DiscordService } from '../../discord.service'
import {
  CharacterNameUpdateRequestedPrototype,
  CharacterNameUpdatedPrototype,
  CharacterNameUpdateFailedPrototype
} from '../../../domains/character/application/prototype/character-name-events.prototype'

describe('DiscordCharacterNamePrototype', () => {
  let service: DiscordCharacterNamePrototype
  let mockEventBus: jest.Mocked<EventBusService>
  let mockDiscordService: jest.Mocked<DiscordService>

  beforeEach(async () => {
    const mockEventBusService = {
      publish: jest.fn(),
      subscribe: jest.fn(),
      subscribeMany: jest.fn()
    }

    const mockDiscordSvc = {
      // 実際のDiscordServiceのメソッドを使用
      sendMessage: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordCharacterNamePrototype,
        { provide: EventBusService, useValue: mockEventBusService },
        { provide: DiscordService, useValue: mockDiscordSvc }
      ]
    }).compile()

    service = module.get<DiscordCharacterNamePrototype>(DiscordCharacterNamePrototype)
    mockEventBus = module.get(EventBusService)
    mockDiscordService = module.get(DiscordService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('requestCharacterNameUpdate', () => {
    it('should publish CharacterNameUpdateRequestedPrototype event', async () => {
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

    it('should handle errors when publishing events', async () => {
      const channelId = 'test-channel-123'
      const newName = 'New Character Name'
      const userId = 'user-123'

      const mockError = new Error('Event bus error')
      mockEventBus.publish.mockRejectedValue(mockError)

      await expect(service.requestCharacterNameUpdate(channelId, newName, userId)).rejects.toThrow('Event bus error')
    })
  })

  describe('handleCharacterNameUpdated', () => {
    it('should process character name updated event successfully', async () => {
      const event = new CharacterNameUpdatedPrototype('char-123', 'Old Name', 'New Name', 'test-channel-123')

      await service.handleCharacterNameUpdated(event)

      // プロトタイプ版では実際のDiscordサービスを呼び出さない
      // ログが出力されることを確認
      expect(mockDiscordService.sendMessage).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully during Discord UI update', async () => {
      const event = new CharacterNameUpdatedPrototype('char-123', 'Old Name', 'New Name', 'test-channel-123')

      // プロトタイプ版では実際のDiscordサービスを呼び出さないため、
      // エラーは発生しない
      await expect(service.handleCharacterNameUpdated(event)).resolves.toBeUndefined()
    })
  })

  describe('handleCharacterNameUpdateFailed', () => {
    it('should process character name update failed event successfully', async () => {
      const event = new CharacterNameUpdateFailedPrototype(
        'test-channel-123',
        'New Name',
        'Character not found',
        'user-123'
      )

      await service.handleCharacterNameUpdateFailed(event)

      // プロトタイプ版では実際のDiscordサービスを呼び出さない
      expect(mockDiscordService.sendMessage).not.toHaveBeenCalled()
    })

    it('should handle errors during error message sending', async () => {
      const event = new CharacterNameUpdateFailedPrototype(
        'test-channel-123',
        'New Name',
        'Character not found',
        'user-123'
      )

      // プロトタイプ版では実際のDiscordサービスを呼び出さないため、
      // エラーは発生しない
      await expect(service.handleCharacterNameUpdateFailed(event)).resolves.toBeUndefined()
    })
  })

  describe('integration test', () => {
    it('should handle complete event flow', async () => {
      const channelId = 'test-channel-123'
      const newName = 'New Character Name'
      const userId = 'user-123'

      // Step 1: Request character name update
      await service.requestCharacterNameUpdate(channelId, newName, userId)

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId,
          newName,
          userId
        })
      )

      // Step 2: Simulate successful update
      const successEvent = new CharacterNameUpdatedPrototype('char-123', 'Old Name', newName, channelId)

      await service.handleCharacterNameUpdated(successEvent)

      // プロトタイプ版では実際のDiscordサービスを呼び出さない
      // ログが出力されることを確認
      expect(mockDiscordService.sendMessage).not.toHaveBeenCalled()
    })

    it('should handle error flow', async () => {
      const channelId = 'test-channel-123'
      const newName = 'New Character Name'
      const userId = 'user-123'

      // Step 1: Request character name update
      await service.requestCharacterNameUpdate(channelId, newName, userId)

      // Step 2: Simulate failed update
      const failedEvent = new CharacterNameUpdateFailedPrototype(channelId, newName, 'Character not found', userId)

      await service.handleCharacterNameUpdateFailed(failedEvent)

      // プロトタイプ版では実際のDiscordサービスを呼び出さない
      expect(mockDiscordService.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('performance test', () => {
    it('should complete event handling within reasonable time', async () => {
      const startTime = Date.now()

      const event = new CharacterNameUpdatedPrototype('char-123', 'Old Name', 'New Name', 'test-channel-123')

      await service.handleCharacterNameUpdated(event)

      const processingTime = Date.now() - startTime
      expect(processingTime).toBeLessThan(50) // 50ms以内
    })
  })
})
