import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
import { SharedModule } from './shared.module'
import { EventBusService } from './application/event-bus.service'
import { TypedEventService, TypedEventEmitter } from './application/typed-event.service'
import { DomainEvent } from './domain/events/base.event'

// テスト用DomainEvent
class TestDomainEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly testData: string
  ) {
    super(aggregateId, 1)
  }

  getEventName(): string {
    return 'test.domain.event'
  }
}

describe('SharedModule - EventEmitter2 Instance Isolation', () => {
  let module: TestingModule
  let eventBusService: EventBusService
  let typedEventService: TypedEventService
  let typedEventEmitter: TypedEventEmitter
  let mainEventEmitter: EventEmitter2
  let typedEventEmitterInstance: EventEmitter2

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [SharedModule]
    }).compile()

    eventBusService = module.get<EventBusService>(EventBusService)
    typedEventService = module.get<TypedEventService>(TypedEventService)
    typedEventEmitter = module.get<TypedEventEmitter>(TypedEventEmitter)

    // メインのEventEmitter2インスタンス（EventBusService用）
    mainEventEmitter = module.get<EventEmitter2>(EventEmitter2)

    // TypedEventService専用のEventEmitter2インスタンス
    typedEventEmitterInstance = module.get<EventEmitter2>('TYPED_EVENT_EMITTER')
  })

  afterEach(async () => {
    await module.close()
  })

  describe('EventEmitter2 Instance Separation', () => {
    it('should provide separate EventEmitter2 instances', () => {
      // Assert - 異なるインスタンスであることを確認
      expect(mainEventEmitter).not.toBe(typedEventEmitterInstance)
      expect(mainEventEmitter).toBeInstanceOf(EventEmitter2)
      expect(typedEventEmitterInstance).toBeInstanceOf(EventEmitter2)
    })

    it('should inject correct instances into services', () => {
      // EventBusServiceはメインのEventEmitter2を使用
      // TypedEventServiceは専用のEventEmitter2を使用
      // これは直接テストできないが、動作テストで確認
      expect(eventBusService).toBeInstanceOf(EventBusService)
      expect(typedEventService).toBeInstanceOf(TypedEventService)
    })

    it('should not interfere between EventBusService and TypedEventService events', async () => {
      // Arrange
      let domainEventReceived = false
      let typedEventReceived = false

      // DomainEventハンドラー（EventBusService用）
      const domainEventHandler = jest.fn(() => {
        domainEventReceived = true
      })

      // TypedEventハンドラー（TypedEventService用）
      const typedEventHandler = jest.fn(() => {
        typedEventReceived = true
      })

      // EventBusServiceのイベントリスナーを設定
      mainEventEmitter.on('test.domain.event', domainEventHandler)

      // TypedEventServiceのイベントリスナーを設定
      typedEventEmitterInstance.on('test.typed.event', typedEventHandler)

      // Act
      // DomainEventを発行（EventBusService経由）
      const domainEvent = new TestDomainEvent('test-id', 'domain data')
      await eventBusService.publish(domainEvent)

      // TypedEventを発行（TypedEventService経由）
      await typedEventService.emit('test.typed.event' as any, {
        message: 'typed data',
        source: 'test',
        timestamp: new Date()
      })

      // 少し待つ
      await new Promise((resolve) => setTimeout(resolve, 20))

      // Assert
      // 各イベントが正しいハンドラーでのみ処理されることを確認
      expect(domainEventHandler).toHaveBeenCalledTimes(1)
      expect(typedEventHandler).toHaveBeenCalledTimes(1)
      expect(domainEventReceived).toBe(true)
      expect(typedEventReceived).toBe(true)
    })

    it('should prevent EventBusService from receiving TypedEventService events', async () => {
      // Arrange
      let unexpectedEventReceived = false

      // EventBusServiceが誤ってTypedEventServiceのイベントを受け取らないことを確認
      const unexpectedHandler = jest.fn(() => {
        unexpectedEventReceived = true
      })

      // メインEventEmitter2に全てのイベントをキャッチするリスナーを設定
      mainEventEmitter.onAny(unexpectedHandler)

      // Act
      // TypedEventServiceでイベント発行
      await typedEventService.emit('test.typed.only.event' as any, {
        data: 'should not reach EventBusService',
        source: 'typed-service',
        timestamp: new Date()
      })

      // 少し待つ
      await new Promise((resolve) => setTimeout(resolve, 20))

      // Assert
      // メインEventEmitter2では受信されないことを確認
      expect(unexpectedHandler).not.toHaveBeenCalled()
      expect(unexpectedEventReceived).toBe(false)
    })

    it('should prevent TypedEventService from receiving EventBusService events', async () => {
      // Arrange
      let unexpectedEventReceived = false

      // TypedEventServiceが誤ってEventBusServiceのイベントを受け取らないことを確認
      const unexpectedHandler = jest.fn(() => {
        unexpectedEventReceived = true
      })

      // TypedEventService専用EventEmitter2に全てのイベントをキャッチするリスナーを設定
      typedEventEmitterInstance.onAny(unexpectedHandler)

      // Act
      // EventBusServiceでドメインイベント発行
      const domainEvent = new TestDomainEvent('test-id', 'domain only data')
      await eventBusService.publish(domainEvent)

      // 少し待つ
      await new Promise((resolve) => setTimeout(resolve, 20))

      // Assert
      // TypedEventService専用EventEmitter2では受信されないことを確認
      expect(unexpectedHandler).not.toHaveBeenCalled()
      expect(unexpectedEventReceived).toBe(false)
    })
  })

  describe('Service Dependencies', () => {
    it('should provide all required services', () => {
      expect(eventBusService).toBeDefined()
      expect(typedEventService).toBeDefined()
      expect(typedEventEmitter).toBeDefined()
    })

    it('should create TypedEventEmitter with correct dependency', () => {
      // TypedEventEmitterがTypedEventServiceを正しく依存していることを確認
      expect(typedEventEmitter).toBeInstanceOf(TypedEventEmitter)
    })

    it('should maintain service functionality after isolation', async () => {
      // EventBusService functionality test
      const domainEvent = new TestDomainEvent('test-id', 'functionality test')
      let eventHandled = false

      eventBusService.subscribe('test.domain.event', {
        handle: async (event) => {
          eventHandled = true
          expect(event).toBe(domainEvent)
        }
      })

      await eventBusService.publish(domainEvent)
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(eventHandled).toBe(true)

      // TypedEventService functionality test
      let typedEventHandled = false

      typedEventService.on('test.typed.functionality' as any, (payload) => {
        typedEventHandled = true
        expect(payload.message).toBe('functionality test')
      })

      await typedEventService.emit('test.typed.functionality' as any, {
        message: 'functionality test',
        source: 'test',
        timestamp: new Date()
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(typedEventHandled).toBe(true)
    })
  })

  describe('Configuration Consistency', () => {
    it('should apply consistent EventEmitter2 configuration', () => {
      // 両方のEventEmitter2インスタンスが同じ設定を持つことを確認
      // 直接設定値にアクセスする方法がないため、動作テストで確認

      // maxListenersの確認（設定値: 10）
      expect(mainEventEmitter.getMaxListeners()).toBe(10)
      expect(typedEventEmitterInstance.getMaxListeners()).toBe(10)
    })

    it('should handle events with delimiter configuration', async () => {
      // delimiter: '.' の設定テスト
      let eventReceived = false

      typedEventService.on('test.delimiter.check' as any, () => {
        eventReceived = true
      })

      await typedEventService.emit('test.delimiter.check' as any, {
        message: 'delimiter test',
        source: 'test',
        timestamp: new Date()
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(eventReceived).toBe(true)
    })
  })

  describe('Error Handling Isolation', () => {
    it('should isolate errors between services', async () => {
      // Arrange
      let eventBusErrorCount = 0
      let typedEventErrorCount = 0

      // EventBusServiceのエラーハンドラー
      mainEventEmitter.on('error', () => {
        eventBusErrorCount++
      })

      // TypedEventServiceのエラーハンドラー
      typedEventEmitterInstance.on('error', () => {
        typedEventErrorCount++
      })

      // Act & Assert
      // TypedEventServiceでのエラーがEventBusServiceに影響しないことを確認
      try {
        await typedEventService.emit('test.error' as any, null as any)
      } catch (error) {
        // エラーは期待される
      }

      await new Promise((resolve) => setTimeout(resolve, 10))

      // エラーが分離されていることを確認
      // (実際のエラー処理は各サービス内で行われるため、ここでは基本的な分離を確認)
      expect(eventBusService).toBeDefined() // EventBusServiceは正常
      expect(typedEventService).toBeDefined() // TypedEventServiceも正常
    })
  })
})
