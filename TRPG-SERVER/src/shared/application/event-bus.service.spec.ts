import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
import { EventBusService, EventPublishingFailed, EventHandlingFailed } from './event-bus.service'
import { DomainEvent, EventHandler, ErrorEvent } from '../domain/events/base.event'

// テスト用ドメインイベント
class TestDomainEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly testData: string,
    version: number = 1
  ) {
    super(aggregateId, version)
  }

  getEventName(): string {
    return 'test.domain.event'
  }
}

// テスト用エラーイベント
class TestErrorEvent extends ErrorEvent {
  constructor(aggregateId: string, error: Error | string) {
    super(aggregateId, error, 'test-source')
  }

  getEventName(): string {
    return 'test.error.event'
  }
}

// テスト用イベントハンドラー
class TestEventHandler implements EventHandler<TestDomainEvent> {
  public handledEvents: TestDomainEvent[] = []
  public shouldThrowError = false

  async handle(event: TestDomainEvent): Promise<void> {
    if (this.shouldThrowError) {
      throw new Error('Test handler error')
    }
    this.handledEvents.push(event)
  }
}

describe('EventBusService', () => {
  let eventBusService: EventBusService
  let eventEmitter: EventEmitter2
  let module: TestingModule

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({
          wildcard: false,
          delimiter: '.',
          maxListeners: 10,
          ignoreErrors: false
        })
      ],
      providers: [EventBusService]
    }).compile()

    eventBusService = module.get<EventBusService>(EventBusService)
    eventEmitter = module.get<EventEmitter2>(EventEmitter2)

    // 各テスト前にリスナーをクリア
    eventEmitter.removeAllListeners()

    // EventBusServiceのハンドラーもクリア
    const handlerInfo = eventBusService.getHandlerInfo()
    for (const eventName of Object.keys(handlerInfo)) {
      eventBusService.removeAllListeners(eventName)
    }
  })

  afterEach(async () => {
    // テスト終了後にすべてのリスナーをクリア
    eventEmitter.removeAllListeners()
    const handlerInfo = eventBusService.getHandlerInfo()
    for (const eventName of Object.keys(handlerInfo)) {
      eventBusService.removeAllListeners(eventName)
    }
    await module.close()
  })

  describe('publish', () => {
    it('should successfully publish a domain event', async () => {
      // Arrange
      const testEvent = new TestDomainEvent('test-aggregate-id', 'test data')
      const handler = new TestEventHandler()

      eventBusService.subscribe('test.domain.event', handler)

      // Act
      await eventBusService.publish(testEvent)

      // Assert
      expect(handler.handledEvents).toHaveLength(1)
      expect(handler.handledEvents[0]).toBe(testEvent)
      expect(handler.handledEvents[0].testData).toBe('test data')
    })

    it('should emit event through EventEmitter2', async () => {
      // Arrange
      const testEvent = new TestDomainEvent('test-aggregate-id', 'test data')
      const emitterSpy = jest.spyOn(eventEmitter, 'emitAsync')

      // Act
      await eventBusService.publish(testEvent)

      // Assert
      expect(emitterSpy).toHaveBeenCalledWith('test.domain.event', testEvent)
    })

    it('should handle multiple handlers for the same event', async () => {
      // Arrange
      const testEvent = new TestDomainEvent('test-aggregate-id', 'test data')
      const handler1 = new TestEventHandler()
      const handler2 = new TestEventHandler()

      eventBusService.subscribe('test.domain.event', handler1)
      eventBusService.subscribe('test.domain.event', handler2)

      // Act
      await eventBusService.publish(testEvent)

      // Assert
      expect(handler1.handledEvents).toHaveLength(1)
      expect(handler2.handledEvents).toHaveLength(1)
    })

    it('should publish error event when handler fails', async () => {
      // Arrange
      const testEvent = new TestDomainEvent('test-aggregate-id', 'test data')
      const handler = new TestEventHandler()
      handler.shouldThrowError = true

      eventBusService.subscribe('test.domain.event', handler)

      const errorEventSpy = jest.spyOn(eventEmitter, 'emitAsync')

      // Act - エラーハンドラーは内部で処理されるため、例外はスローされない
      await eventBusService.publish(testEvent)

      // Assert - Error event should be published
      expect(errorEventSpy).toHaveBeenCalledWith('event.handling.failed', expect.any(EventHandlingFailed))
    })

    it('should not publish error event for ErrorEvent to prevent infinite loop', async () => {
      // Arrange
      const errorEvent = new TestErrorEvent('test-aggregate-id', new Error('Test error'))
      const emitterSpy = jest.spyOn(eventEmitter, 'emitAsync')

      // Act - ErrorEventは例外をスローしない（ただし、emitAsyncがエラーを投げる可能性がある）
      await eventBusService.publish(errorEvent)

      // Assert - should only emit the original error event, not additional error events
      expect(emitterSpy).toHaveBeenCalledTimes(1)
      expect(emitterSpy).toHaveBeenCalledWith('test.error.event', errorEvent)
    })
  })

  describe('subscribe', () => {
    it('should register event handler', () => {
      // Arrange
      const handler = new TestEventHandler()

      // Act
      eventBusService.subscribe('test.domain.event', handler)
      const handlerInfo = eventBusService.getHandlerInfo()

      // Assert
      expect(handlerInfo['test.domain.event']).toBe(1)
    })

    it('should register multiple handlers for same event', () => {
      // Arrange
      const handler1 = new TestEventHandler()
      const handler2 = new TestEventHandler()

      // Act
      eventBusService.subscribe('test.domain.event', handler1)
      eventBusService.subscribe('test.domain.event', handler2)
      const handlerInfo = eventBusService.getHandlerInfo()

      // Assert
      expect(handlerInfo['test.domain.event']).toBe(2)
    })
  })

  describe('subscribeMany', () => {
    it('should register multiple handlers at once', () => {
      // Arrange
      const handler1 = new TestEventHandler()
      const handler2 = new TestEventHandler()
      const handlers = [
        { eventName: 'test.domain.event', handler: handler1 },
        { eventName: 'another.event', handler: handler2 }
      ]

      // Act
      eventBusService.subscribeMany(handlers)
      const handlerInfo = eventBusService.getHandlerInfo()

      // Assert
      expect(handlerInfo['test.domain.event']).toBe(1)
      expect(handlerInfo['another.event']).toBe(1)
    })
  })

  describe('unsubscribe', () => {
    it('should remove event handler', () => {
      // Arrange
      const handler = new TestEventHandler()
      eventBusService.subscribe('test.domain.event', handler)

      // Act
      eventBusService.unsubscribe('test.domain.event', handler)
      const handlerInfo = eventBusService.getHandlerInfo()

      // Assert
      expect(handlerInfo['test.domain.event']).toBe(0)
    })
  })

  describe('removeAllListeners', () => {
    it('should remove all handlers for event', () => {
      // Arrange
      const handler1 = new TestEventHandler()
      const handler2 = new TestEventHandler()
      eventBusService.subscribe('test.domain.event', handler1)
      eventBusService.subscribe('test.domain.event', handler2)

      // Act
      eventBusService.removeAllListeners('test.domain.event')
      const handlerInfo = eventBusService.getHandlerInfo()

      // Assert
      expect(handlerInfo['test.domain.event']).toBeUndefined()
    })
  })

  describe('getHandlerInfo', () => {
    it('should return handler count information', () => {
      // Arrange
      const handler = new TestEventHandler()
      eventBusService.subscribe('test.domain.event', handler)

      // Act
      const handlerInfo = eventBusService.getHandlerInfo()

      // Assert
      expect(handlerInfo).toEqual({
        'test.domain.event': 1
      })
    })
  })

  describe('Error Events', () => {
    describe('EventPublishingFailed', () => {
      it('should create error event with correct properties', () => {
        // Arrange
        const originalEvent = new TestDomainEvent('test-id', 'data')
        const error = new Error('Test error')

        // Act
        const errorEvent = new EventPublishingFailed('test-id', 'test.event', originalEvent, error)

        // Assert
        expect(errorEvent.getEventName()).toBe('event.publishing.failed')
        expect(errorEvent.originalEventName).toBe('test.event')
        expect(errorEvent.originalEvent).toBe(originalEvent)
        expect(errorEvent.error).toBe(error)
      })
    })

    describe('EventHandlingFailed', () => {
      it('should create error event with correct properties', () => {
        // Arrange
        const originalEvent = new TestDomainEvent('test-id', 'data')
        const error = new Error('Test error')

        // Act
        const errorEvent = new EventHandlingFailed('test-id', 'test.event', originalEvent, error)

        // Assert
        expect(errorEvent.getEventName()).toBe('event.handling.failed')
        expect(errorEvent.eventName).toBe('test.event')
        expect(errorEvent.originalEvent).toBe(originalEvent)
        expect(errorEvent.error).toBe(error)
      })
    })
  })
})
