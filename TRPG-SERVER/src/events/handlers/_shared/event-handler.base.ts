import { Logger } from '@nestjs/common'
import { TypedEventService } from '../../../shared/application/typed-event.service'
import { randomBytes } from 'crypto'

/**
 * Event Handler 基底クラス
 *
 * 🎯 責務:
 * - 共通のログ・エラーハンドリング・バリデーション
 * - リトライ・冪等性・観測性の基盤
 * - ハンドラー実装の規約強制
 */
export abstract class EventHandler<TEvent = any> {
  protected readonly logger: Logger
  protected typedEventService?: TypedEventService

  constructor() {
    this.logger = new Logger(this.constructor.name)
  }

  /**
   * TypedEventServiceの設定（EventRegistryServiceから呼び出し）
   */
  setTypedEventService(typedEventService: TypedEventService): void {
    this.typedEventService = typedEventService
  }

  /**
   * ハンドラーが処理するイベント名（必須実装）
   */
  abstract getEventName(): string

  /**
   * メインの処理ロジック（必須実装）
   */
  abstract handle(event: TEvent, context?: EventContext): Promise<void>

  /**
   * エントリーポイント - 共通処理を含む
   */
  async execute(event: TEvent, context?: EventContext): Promise<void> {
    const eventContext = this.enrichContext(context)
    const startTime = Date.now()

    try {
      // 1. 入力バリデーション
      await this.validateEvent(event)

      // 2. 処理開始ログ
      this.logEventStart(event, eventContext)

      // 3. メイン処理
      await this.handle(event, eventContext)

      // 4. 成功ログ
      const duration = Date.now() - startTime
      this.logEventSuccess(event, eventContext, duration)
    } catch (error) {
      // 5. エラーハンドリング
      const duration = Date.now() - startTime
      await this.handleError(error as Error, event, eventContext, duration)
    }
  }

  /**
   * イベントの入力バリデーション
   */
  protected async validateEvent(event: TEvent): Promise<void> {
    if (!event) {
      throw new ValidationError('Event cannot be null or undefined')
    }

    // 基本構造チェック
    if (typeof event !== 'object') {
      throw new ValidationError('Event must be an object')
    }

    // 継承先でのカスタムバリデーション
    await this.customValidation(event)
  }

  /**
   * カスタムバリデーション（継承先で実装）
   */
  protected async customValidation(event: TEvent): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * コンテキストの拡張
   */
  private enrichContext(context?: EventContext): EventContext {
    return {
      correlationId: context?.correlationId || this.generateCorrelationId(),
      source: context?.source || 'unknown',
      timestamp: context?.timestamp || new Date(),
      handlerName: this.constructor.name,
      eventName: this.getEventName(),
      ...context
    }
  }

  /**
   * 相関IDの生成
   */
  private generateCorrelationId(): string {
    return `evt_${Date.now()}_${randomBytes(4).toString('hex')}`
  }

  /**
   * 処理開始ログ
   */
  private logEventStart(event: TEvent, context: EventContext): void {
    this.logger.log(`🎯 [${context.correlationId}] Event processing started: ${this.getEventName()}`, {
      eventName: this.getEventName(),
      correlationId: context.correlationId,
      source: context.source,
      timestamp: context.timestamp
    })
  }

  /**
   * 成功ログ
   */
  private logEventSuccess(event: TEvent, context: EventContext, duration: number): void {
    this.logger.log(
      `✅ [${context.correlationId}] Event processed successfully: ${this.getEventName()} (${duration}ms)`,
      {
        eventName: this.getEventName(),
        correlationId: context.correlationId,
        duration,
        success: true
      }
    )
  }

  /**
   * エラーハンドリング
   */
  protected async handleError(error: Error, event: TEvent, context: EventContext, duration: number): Promise<void> {
    // 構造化エラーログ
    this.logger.error(`❌ [${context.correlationId}] Event processing failed: ${this.getEventName()} (${duration}ms)`, {
      eventName: this.getEventName(),
      correlationId: context.correlationId,
      error: error.message,
      stack: error.stack,
      duration,
      success: false,
      event: this.sanitizeEventForLogging(event)
    })

    // エラーイベント発行
    await this.emitErrorEvent(error, event, context)

    // リトライ判定
    if (this.isRetryableError(error)) {
      await this.scheduleRetry(event, context, error)
    } else {
      // 致命的エラーの場合は再スロー
      throw error
    }
  }

  /**
   * エラーイベントの発行
   */
  private async emitErrorEvent(error: Error, event: TEvent, context: EventContext): Promise<void> {
    try {
      // システムイベントは内部ログのみとし、外部発行は行わない
      this.logger.error('Event processing failed', {
        eventName: this.getEventName(),
        handlerName: this.constructor.name,
        correlationId: context.correlationId,
        error: error.message,
        originalEvent: this.sanitizeEventForLogging(event),
        timestamp: new Date()
      })
    } catch (emitError) {
      this.logger.error('Failed to log error event', emitError)
    }
  }

  /**
   * リトライ可能エラーの判定
   */
  protected isRetryableError(error: Error): boolean {
    const retryableErrors = ['NetworkError', 'TimeoutError', 'TemporaryError', 'RateLimitError', 'ServiceUnavailable']

    return retryableErrors.some(
      (errorType) =>
        error.name === errorType ||
        error.message.includes(errorType) ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND')
    )
  }

  /**
   * リトライのスケジュール
   */
  private async scheduleRetry(event: TEvent, context: EventContext, error: Error): Promise<void> {
    const retryDelay = this.calculateRetryDelay(context.retryCount || 0)
    const maxRetries = this.getMaxRetries()

    if ((context.retryCount || 0) < maxRetries) {
      this.logger.warn(
        `⏳ Scheduling retry for ${this.getEventName()} in ${retryDelay}ms (attempt ${(context.retryCount || 0) + 1}/${maxRetries})`
      )

      setTimeout(async () => {
        const retryContext = {
          ...context,
          retryCount: (context.retryCount || 0) + 1,
          retryReason: error.message
        }
        await this.execute(event, retryContext)
      }, retryDelay)
    } else {
      this.logger.error(`🚨 Max retries exceeded for ${this.getEventName()}, moving to dead letter queue`)
      await this.moveToDeadLetterQueue(event, context, error)
    }
  }

  /**
   * リトライ遅延の計算（指数バックオフ）
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 1000 // 1秒
    const maxDelay = 30000 // 30秒
    const delay = baseDelay * Math.pow(2, retryCount)
    return Math.min(delay, maxDelay)
  }

  /**
   * 最大リトライ回数
   */
  protected getMaxRetries(): number {
    return 3
  }

  /**
   * デッドレターキューへの移動
   */
  private async moveToDeadLetterQueue(event: TEvent, context: EventContext, error: Error): Promise<void> {
    try {
      // デッドレターキューは内部ログのみとし、外部発行は行わない
      this.logger.error('Event moved to dead letter queue', {
        eventName: this.getEventName(),
        handlerName: this.constructor.name,
        correlationId: context.correlationId,
        originalEvent: this.sanitizeEventForLogging(event),
        finalError: error.message,
        retryCount: context.retryCount || 0,
        timestamp: new Date()
      })
    } catch (dlqError) {
      this.logger.error('Failed to log dead letter queue event', dlqError)
    }
  }

  /**
   * ログ用のイベントサニタイズ（機密情報除去）
   */
  protected sanitizeEventForLogging(event: TEvent): any {
    if (!event || typeof event !== 'object') {
      return event
    }

    const sanitized = JSON.parse(JSON.stringify(event))
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization']

    const removeSensitive = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(removeSensitive)
      }

      if (obj && typeof obj === 'object') {
        const cleaned = { ...obj }
        sensitiveFields.forEach((field) => {
          if (field in cleaned) {
            cleaned[field] = '[REDACTED]'
          }
        })

        Object.keys(cleaned).forEach((key) => {
          cleaned[key] = removeSensitive(cleaned[key])
        })

        return cleaned
      }

      return obj
    }

    return removeSensitive(sanitized)
  }

  // generateShortId メソッドは削除されました
  // 代わりに各ドメインの専用IDサービス（例：CharacterIdService）を使用してください

  /**
   * 安全なオブジェクトアクセス
   */
  protected safeGet<T>(obj: any, path: string, defaultValue: T): T {
    const keys = path.split('.')
    let current = obj

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return defaultValue
      }
    }

    return current !== undefined ? current : defaultValue
  }

  /**
   * ネストされた値の安全な設定
   */
  protected safeSet(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }

    current[keys[keys.length - 1]] = value
  }
}

/**
 * イベントコンテキスト
 */
export interface EventContext {
  correlationId: string
  source: string
  timestamp: Date
  handlerName?: string
  eventName?: string
  retryCount?: number
  retryReason?: string
  userId?: string
  sessionId?: string
  [key: string]: any
}

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * ビジネスロジックエラー
 */
export class BusinessLogicError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'BusinessLogicError'
  }
}

/**
 * 一時的エラー（リトライ可能）
 */
export class TemporaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemporaryError'
  }
}
