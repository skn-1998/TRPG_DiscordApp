import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DomainEvent, EventHandler, ErrorEvent } from '../domain/events/base.event'

/**
 * イベントバスサービス
 * ドメインイベントの発行と処理を管理
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name)
  private readonly handlers = new Map<string, EventHandler<DomainEvent>[]>()

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * ドメインイベントを発行
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const eventName = event.getEventName()
    this.logger.log(`Publishing event: ${eventName} [${event.eventId}]`)

    try {
      // イベントメタデータのログ出力
      this.logger.debug(`Event metadata:`, event.getMetadata())

      // EventEmitter2 を使用してイベント発行
      await this.eventEmitter.emitAsync(eventName, event)

      // 登録されたハンドラーも実行
      const registeredHandlers = this.handlers.get(eventName) || []
      if (registeredHandlers.length > 0) {
        await Promise.all(registeredHandlers.map((handler) => this.executeHandler(handler, event)))
      }

      this.logger.log(`Event published successfully: ${eventName} [${event.eventId}]`)
    } catch (error) {
      this.logger.error(`Error publishing event ${eventName}:`, error)

      // エラーイベントを発行（ただし無限ループを避けるため ErrorEvent の場合は除く）
      if (!(event instanceof ErrorEvent)) {
        await this.publishErrorEvent(eventName, event, error instanceof Error ? error : new Error(String(error)))
      }

      throw error
    }
  }

  /**
   * イベントハンドラーを登録
   */
  subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    this.logger.log(`Subscribing handler for event: ${eventName}`)

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, [])
    }

    this.handlers.get(eventName)!.push(handler)

    // EventEmitter2 にもリスナーを登録
    this.eventEmitter.on(eventName, async (event: T) => {
      await this.executeHandler(handler, event)
    })
  }

  /**
   * 複数のハンドラーをバッチで登録
   */
  subscribeMany(handlers: Array<{ eventName: string; handler: EventHandler<DomainEvent> }>): void {
    this.logger.log(`Subscribing ${handlers.length} handlers`)

    handlers.forEach(({ eventName, handler }) => {
      this.subscribe(eventName, handler)
    })
  }

  /**
   * イベントハンドラーの登録を解除
   */
  unsubscribe(eventName: string, handler: EventHandler<DomainEvent>): void {
    const handlers = this.handlers.get(eventName)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
        this.logger.log(`Unsubscribed handler for event: ${eventName}`)
      }
    }

    // EventEmitter2 からも削除
    this.eventEmitter.removeListener(eventName, handler.handle)
  }

  /**
   * 指定したイベントの全ハンドラーを削除
   */
  removeAllListeners(eventName: string): void {
    this.handlers.delete(eventName)
    this.eventEmitter.removeAllListeners(eventName)
    this.logger.log(`Removed all listeners for event: ${eventName}`)
  }

  /**
   * 登録されているハンドラー情報を取得
   */
  getHandlerInfo(): { [eventName: string]: number } {
    const info: { [eventName: string]: number } = {}

    this.handlers.forEach((handlers, eventName) => {
      info[eventName] = handlers.length
    })

    return info
  }

  /**
   * イベントハンドラーを安全に実行
   */
  private async executeHandler<T extends DomainEvent>(handler: EventHandler<T>, event: T): Promise<void> {
    const eventName = event.getEventName()

    try {
      this.logger.debug(`Executing handler for event: ${eventName} [${event.eventId}]`)
      await handler.handle(event)
      this.logger.debug(`Handler executed successfully for event: ${eventName} [${event.eventId}]`)
    } catch (error) {
      this.logger.error(`Error executing handler for event ${eventName}:`, error)

      // ハンドラーエラーイベントを発行
      await this.publishHandlerErrorEvent(eventName, event, error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * エラーイベントを発行
   */
  private async publishErrorEvent(originalEventName: string, originalEvent: DomainEvent, error: Error): Promise<void> {
    try {
      const errorEvent = new EventPublishingFailed(originalEvent.aggregateId, originalEventName, originalEvent, error)

      // EventEmitter2 のみ使用（無限ループ防止）
      await this.eventEmitter.emitAsync(errorEvent.getEventName(), errorEvent)
    } catch (nestedError) {
      this.logger.error('Failed to publish error event:', nestedError)
    }
  }

  /**
   * ハンドラーエラーイベントを発行
   */
  private async publishHandlerErrorEvent(eventName: string, event: DomainEvent, error: Error): Promise<void> {
    try {
      const errorEvent = new EventHandlingFailed(event.aggregateId, eventName, event, error)

      // EventEmitter2 のみ使用
      await this.eventEmitter.emitAsync(errorEvent.getEventName(), errorEvent)
    } catch (nestedError) {
      this.logger.error('Failed to publish handler error event:', nestedError)
    }
  }
}

/**
 * イベント発行失敗エラーイベント
 */
export class EventPublishingFailed extends ErrorEvent {
  constructor(
    aggregateId: string,
    public readonly originalEventName: string,
    public readonly originalEvent: DomainEvent,
    error: Error
  ) {
    super(aggregateId, error, 'event-bus')
  }

  getEventName(): string {
    return 'event.publishing.failed'
  }
}

/**
 * イベントハンドリング失敗エラーイベント
 */
export class EventHandlingFailed extends ErrorEvent {
  constructor(
    aggregateId: string,
    public readonly eventName: string,
    public readonly originalEvent: DomainEvent,
    error: Error
  ) {
    super(aggregateId, error, 'event-handler')
  }

  getEventName(): string {
    return 'event.handling.failed'
  }
}
