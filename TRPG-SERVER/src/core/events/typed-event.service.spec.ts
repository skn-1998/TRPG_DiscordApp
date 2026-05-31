import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { TypedEventService, TypedEventEmitter } from './typed-event.service'
import { EventPayload } from '../domain/events/event-contracts'

// テスト用イベント契約の拡張
interface TestEventContracts {
  'test.event.simple': {
    message: string
    timestamp: Date
    source: string
  }
  'test.event.character': {
    characterId: string
    characterName: string
    userId: string
    source: string
    timestamp: Date
  }
  'test.event.error': {
    error: string
    source: string
    timestamp: Date
  }
}

// テスト用型定義
type TestEventName = keyof TestEventContracts
type TestEventPayload<T extends TestEventName> = TestEventContracts[T]

describe('TypedEventService', () => {
  let typedEventService: TypedEventService
  let eventEmitter: EventEmitter2
  let module: TestingModule

  beforeEach(async () => {
    // 独立したEventEmitter2インスタンスを作成（実際のSharedModuleと同じパターン）
    const testEventEmitter = new EventEmitter2({
      wildcard: false,
      delimiter: '.',
      maxListeners: 10,
      ignoreErrors: false
    })

    module = await Test.createTestingModule({
      providers: [
        {
          provide: 'TYPED_EVENT_EMITTER',
          useValue: testEventEmitter
        },
        {
          provide: TypedEventService,
          useFactory: (emitter: EventEmitter2) => new TypedEventService(emitter),
          inject: ['TYPED_EVENT_EMITTER']
        }
      ]
    }).compile()

    typedEventService = module.get<TypedEventService>(TypedEventService)
    eventEmitter = module.get<EventEmitter2>('TYPED_EVENT_EMITTER')
  })

  afterEach(async () => {
    // リスナーをクリアしてテスト間の干渉を防ぐ
    eventEmitter.removeAllListeners()
    await module.close()
  })

  describe('emit', () => {
    it('should successfully emit typed events', async () => {
      // Arrange
      const payload: TestEventPayload<'test.event.simple'> = {
        message: 'Hello, World!',
        timestamp: new Date(),
        source: 'test-source'
      }

      const emitSpy = jest.spyOn(eventEmitter, 'emitAsync')

      // Act
      await expect(typedEventService.emit('test.event.simple' as any, payload)).resolves.not.toThrow()

      // Assert
      expect(emitSpy).toHaveBeenCalledWith('test.event.simple', payload)
    })

    it('should emit character events with proper payload', async () => {
      // Arrange
      const payload: TestEventPayload<'test.event.character'> = {
        characterId: 'char-123',
        characterName: 'Test Character',
        userId: 'user-456',
        source: 'character-service',
        timestamp: new Date()
      }

      const emitSpy = jest.spyOn(eventEmitter, 'emitAsync')

      // Act
      await typedEventService.emit('test.event.character' as any, payload)

      // Assert
      expect(emitSpy).toHaveBeenCalledWith('test.event.character', payload)
    })

    it('should validate payload before emitting', async () => {
      // Arrange
      const invalidPayload = null

      // Act & Assert
      await expect(typedEventService.emit('test.event.simple' as any, invalidPayload as any)).rejects.toThrow(
        '[TYPED-EVENT] Payload is required for event: test.event.simple'
      )
    })

    it('should validate payload is an object', async () => {
      // Arrange
      const invalidPayload = 'not an object'

      // Act & Assert
      await expect(typedEventService.emit('test.event.simple' as any, invalidPayload as any)).rejects.toThrow(
        '[TYPED-EVENT] Payload must be an object for event: test.event.simple'
      )
    })

    it('should validate source field if present', async () => {
      // Arrange
      const invalidPayload = {
        message: 'test',
        timestamp: new Date(),
        source: 123 // should be string
      }

      // Act & Assert
      await expect(typedEventService.emit('test.event.simple' as any, invalidPayload as any)).rejects.toThrow(
        '[TYPED-EVENT] Source must be a string for event: test.event.simple'
      )
    })

    it('should validate timestamp field if present', async () => {
      // Arrange
      const invalidPayload = {
        message: 'test',
        timestamp: 'not a date', // should be Date
        source: 'test-source'
      }

      // Act & Assert
      await expect(typedEventService.emit('test.event.simple' as any, invalidPayload as any)).rejects.toThrow(
        '[TYPED-EVENT] Timestamp must be a Date for event: test.event.simple'
      )
    })
  })

  describe('on', () => {
    it('should register event listener', async () => {
      // Arrange
      let receivedPayload: TestEventPayload<'test.event.simple'> | null = null
      const handler = (payload: TestEventPayload<'test.event.simple'>) => {
        receivedPayload = payload
      }

      const testPayload: TestEventPayload<'test.event.simple'> = {
        message: 'Test message',
        timestamp: new Date(),
        source: 'test-source'
      }

      // Act
      typedEventService.on('test.event.simple' as any, handler)
      await typedEventService.emit('test.event.simple' as any, testPayload)

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Assert
      expect(receivedPayload).toEqual(testPayload)
    })

    it('should handle async event listeners', async () => {
      // Arrange
      let handlerExecuted = false
      const asyncHandler = async (payload: TestEventPayload<'test.event.simple'>) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        handlerExecuted = true
      }

      const testPayload: TestEventPayload<'test.event.simple'> = {
        message: 'Async test',
        timestamp: new Date(),
        source: 'test-source'
      }

      // Act
      typedEventService.on('test.event.simple' as any, asyncHandler)
      await typedEventService.emit('test.event.simple' as any, testPayload)

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 15))

      // Assert
      expect(handlerExecuted).toBe(true)
    })

    it('should handle errors in event listeners', async () => {
      // Arrange
      const errorHandler = () => {
        throw new Error('Handler error')
      }

      const testPayload: TestEventPayload<'test.event.simple'> = {
        message: 'Error test',
        timestamp: new Date(),
        source: 'test-source'
      }

      // Act
      typedEventService.on('test.event.simple' as any, errorHandler)

      // TypedEventServiceは内部でエラーを処理するため、例外がスローされる
      await expect(typedEventService.emit('test.event.simple' as any, testPayload)).rejects.toThrow('Handler error')
    })
  })

  describe('once', () => {
    it('should register one-time event listener', async () => {
      // Arrange
      let handlerCallCount = 0
      const handler = () => {
        handlerCallCount++
      }

      const testPayload: TestEventPayload<'test.event.simple'> = {
        message: 'Once test',
        timestamp: new Date(),
        source: 'test-source'
      }

      // Act
      typedEventService.once('test.event.simple' as any, handler)

      // Emit twice
      await typedEventService.emit('test.event.simple' as any, testPayload)
      await typedEventService.emit('test.event.simple' as any, testPayload)

      // Wait for async handlers
      await new Promise((resolve) => setTimeout(resolve, 20))

      // Assert - should only be called once
      expect(handlerCallCount).toBe(1)
    })
  })

  describe('off', () => {
    it('should remove event listener', async () => {
      // Arrange
      let handlerCallCount = 0
      const handler = () => {
        handlerCallCount++
      }

      const testPayload: TestEventPayload<'test.event.simple'> = {
        message: 'Off test',
        timestamp: new Date(),
        source: 'test-source'
      }

      // Act - まずイベントを発行してハンドラーが動作することを確認
      typedEventService.on('test.event.simple' as any, handler)
      await typedEventService.emit('test.event.simple' as any, testPayload)
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handlerCallCount).toBe(1) // 最初に呼び出されることを確認

      // ハンドラーを削除
      typedEventService.off('test.event.simple' as any, handler)

      // 再度イベントを発行
      await typedEventService.emit('test.event.simple' as any, testPayload)
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Assert - ハンドラーが削除されているため、カウントが増えない
      expect(handlerCallCount).toBe(1)
    })
  })

  describe('registerMultiple', () => {
    it('should register multiple listeners at once', async () => {
      // Arrange
      let handler1Called = false
      let handler2Called = false

      const listeners = [
        {
          event: 'test.event.simple' as any,
          handler: () => {
            handler1Called = true
          }
        },
        {
          event: 'test.event.character' as any,
          handler: () => {
            handler2Called = true
          }
        }
      ]

      const payload1: TestEventPayload<'test.event.simple'> = {
        message: 'Multiple test 1',
        timestamp: new Date(),
        source: 'test'
      }

      const payload2: TestEventPayload<'test.event.character'> = {
        characterId: 'char-123',
        characterName: 'Test Char',
        userId: 'user-456',
        source: 'test',
        timestamp: new Date()
      }

      // Act
      typedEventService.registerMultiple(listeners)
      await typedEventService.emit('test.event.simple' as any, payload1)
      await typedEventService.emit('test.event.character' as any, payload2)

      // Wait for async handlers
      await new Promise((resolve) => setTimeout(resolve, 20))

      // Assert
      expect(handler1Called).toBe(true)
      expect(handler2Called).toBe(true)
    })
  })

  describe('removeAllListeners', () => {
    it('should remove all listeners for event', async () => {
      // Arrange
      let handlerCalled = false
      const handler = () => {
        handlerCalled = true
      }

      const testPayload: TestEventPayload<'test.event.simple'> = {
        message: 'Remove all test',
        timestamp: new Date(),
        source: 'test-source'
      }

      // Act
      typedEventService.on('test.event.simple' as any, handler)
      typedEventService.removeAllListeners('test.event.simple' as any)
      await typedEventService.emit('test.event.simple' as any, testPayload)

      // Wait for potential async handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Assert
      expect(handlerCalled).toBe(false)
    })
  })

  describe('waitForEvent', () => {
    it('should wait for event and resolve with payload', async () => {
      // Arrange
      const testPayload: TestEventPayload<'test.event.simple'> = {
        message: 'Wait test',
        timestamp: new Date(),
        source: 'test-source'
      }

      // Act - emit event after a short delay
      setTimeout(async () => {
        await typedEventService.emit('test.event.simple' as any, testPayload)
      }, 10)

      const receivedPayload = await typedEventService.waitForEvent('test.event.simple' as any, 100)

      // Assert
      expect(receivedPayload).toEqual(testPayload)
    })

    it('should timeout if event is not emitted', async () => {
      // Act & Assert
      await expect(typedEventService.waitForEvent('test.event.simple' as any, 10)).rejects.toThrow(
        'Event test.event.simple timeout after 10ms'
      )
    })
  })
})

describe('TypedEventEmitter', () => {
  let typedEventEmitter: TypedEventEmitter
  let typedEventService: TypedEventService

  beforeEach(async () => {
    const testEventEmitter = new EventEmitter2({
      wildcard: false,
      delimiter: '.',
      maxListeners: 10,
      ignoreErrors: false
    })

    const module = await Test.createTestingModule({
      providers: [
        {
          provide: 'TYPED_EVENT_EMITTER',
          useValue: testEventEmitter
        },
        {
          provide: TypedEventService,
          useFactory: (emitter: EventEmitter2) => new TypedEventService(emitter),
          inject: ['TYPED_EVENT_EMITTER']
        },
        {
          provide: TypedEventEmitter,
          useFactory: (service: TypedEventService) => new TypedEventEmitter(service),
          inject: [TypedEventService]
        }
      ]
    }).compile()

    typedEventService = module.get<TypedEventService>(TypedEventService)
    typedEventEmitter = module.get<TypedEventEmitter>(TypedEventEmitter)
  })

  describe('helper methods', () => {
    it('should emit character search request', async () => {
      // Arrange
      const emitSpy = jest.spyOn(typedEventService, 'emit')

      // Act
      await typedEventEmitter.requestCharacterSearch('channel-123', 'test-source', 'info')

      // Assert
      expect(emitSpy).toHaveBeenCalledWith('character.findByChannelId.requested', {
        channelId: 'channel-123',
        source: 'test-source',
        timestamp: expect.any(Date),
        tabType: 'info'
      })
    })

    it('should emit character creation request', async () => {
      // Arrange
      const createData = {
        characterId: '',
        characterName: 'Test Character',
        gameSystemId: 'coc',
        discordChannelId: 'channel-123',
        discordUserId: 'user-456'
      } as any

      const emitSpy = jest.spyOn(typedEventService, 'emit')

      // Act
      await typedEventEmitter.requestCharacterCreation(createData, 'user-456', 'test-source')

      // Assert
      expect(emitSpy).toHaveBeenCalledWith('character.creation.requested', {
        createData,
        userId: 'user-456',
        source: 'test-source',
        timestamp: expect.any(Date)
      })
    })

    it('should emit dice roll request', async () => {
      // Arrange
      const emitSpy = jest.spyOn(typedEventService, 'emit')

      // Act
      await typedEventEmitter.requestDiceRoll('channel-123', '1d100', 'user-456', 'test-source')

      // Assert
      expect(emitSpy).toHaveBeenCalledWith('diceroll.execute.requested', {
        channelId: 'channel-123',
        diceExpression: '1d100',
        userId: 'user-456',
        source: 'test-source',
        timestamp: expect.any(Date)
      })
    })
  })
})
