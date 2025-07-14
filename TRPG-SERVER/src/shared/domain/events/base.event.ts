import { randomUUID } from 'crypto'

/**
 * ドメインイベントの基底クラス
 * すべてのドメインイベントはこのクラスを継承する
 */
export abstract class DomainEvent {
  readonly occurredOn: Date
  readonly eventId: string
  readonly aggregateId: string
  readonly version: number

  constructor(aggregateId: string, version: number = 1) {
    this.aggregateId = aggregateId
    this.eventId = randomUUID()
    this.occurredOn = new Date()
    this.version = version
  }

  /**
   * イベント名を取得
   * 各具象クラスで実装する
   */
  abstract getEventName(): string

  /**
   * イベントのメタデータを取得
   */
  getMetadata(): EventMetadata {
    return {
      eventId: this.eventId,
      eventName: this.getEventName(),
      aggregateId: this.aggregateId,
      occurredOn: this.occurredOn,
      version: this.version
    }
  }

  /**
   * イベントを JSON として出力
   */
  toJSON(): EventJSON {
    return {
      ...this.getMetadata(),
      data: this
    }
  }
}

/**
 * イベントメタデータの型定義
 */
export interface EventMetadata {
  eventId: string
  eventName: string
  aggregateId: string
  occurredOn: Date
  version: number
}

/**
 * イベントJSON形式の型定義
 */
export interface EventJSON {
  eventId: string
  eventName: string
  aggregateId: string
  occurredOn: Date
  version: number
  data: DomainEvent
}

/**
 * イベントハンドラーのインターフェース
 */
export interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>
}

/**
 * エラーイベントの基底クラス
 */
export abstract class ErrorEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly error: Error | string,
    public readonly source: string,
    version: number = 1
  ) {
    super(aggregateId, version)
  }

  getErrorMessage(): string {
    return typeof this.error === 'string' ? this.error : this.error.message
  }
}

/**
 * システムイベントの基底クラス（監査ログ等）
 */
export abstract class SystemEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly userId?: string,
    public readonly source: string = 'system',
    version: number = 1
  ) {
    super(aggregateId, version)
  }
}
