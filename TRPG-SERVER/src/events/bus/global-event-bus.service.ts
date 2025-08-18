import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { GlobalEventType, getEventCategory, getEventPriority } from '../contracts'
import { SystemErrorEvent } from '../contracts/system-events.contract'

/**
 * Global Event Bus Service
 * ルートレベルのグローバルイベントバス
 * 既存のTypedEventServiceと連携・統合
 */
@Injectable()
export class GlobalEventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GlobalEventBusService.name)
  private eventMetrics = new Map<
    string,
    {
      count: number
      lastEmitted: Date
      totalProcessingTime: number
      errorCount: number
    }
  >()

  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.logger.log('Global Event Bus Service initialized')
    this.setupGlobalErrorHandling()
  }

  onModuleDestroy() {
    this.logger.log('Global Event Bus Service destroyed')
    this.logEventMetrics()
  }

  /**
   * グローバルイベント発行
   */
  async emit<T extends GlobalEventType>(event: T): Promise<boolean> {
    const startTime = Date.now()

    try {
      // イベントメトリクス更新
      this.updateEventMetrics(event.type, startTime)

      // 優先度によるログレベル調整
      const priority = getEventPriority(event.type)
      const category = getEventCategory(event.type)

      if (priority >= 3) {
        // HIGH or CRITICAL
        this.logger.warn(`🚨 High Priority Event: ${event.type} [${category}]`)
      } else {
        this.logger.debug(`📤 Event Emitted: ${event.type} [${category}]`)
      }

      // EventEmitter2経由でイベント発行
      const result = await this.eventEmitter.emitAsync(event.type, event)

      // 処理時間記録
      const processingTime = Date.now() - startTime
      this.updateProcessingTime(event.type, processingTime)

      return Array.isArray(result) ? result.length > 0 : result
    } catch (error) {
      this.logger.error(`❌ Event emission failed: ${event.type}`, error)
      this.updateErrorMetrics(event.type)
      throw error
    }
  }

  /**
   * グローバルイベントリスナー登録
   */
  on<T extends GlobalEventType>(eventType: T['type'], handler: (event: T) => Promise<void> | void): void {
    this.eventEmitter.on(eventType, async (event: T) => {
      const startTime = Date.now()
      try {
        await handler(event)
        const processingTime = Date.now() - startTime
        this.logger.debug(`✅ Event Handler Completed: ${eventType} (${processingTime}ms)`)
      } catch (error) {
        this.logger.error(`❌ Event Handler Failed: ${eventType}`, error)
        this.updateErrorMetrics(eventType)
        throw error
      }
    })

    this.logger.debug(`📝 Event Handler Registered: ${eventType}`)
  }

  /**
   * イベントリスナー削除
   */
  off(eventType: string, handler?: any): void {
    if (handler) {
      this.eventEmitter.off(eventType, handler)
    } else {
      this.eventEmitter.removeAllListeners(eventType)
    }

    this.logger.debug(`🗑️ Event Handler Removed: ${eventType}`)
  }

  /**
   * イベントメトリクス取得
   */
  getEventMetrics(): Map<string, any> {
    return new Map(this.eventMetrics)
  }

  /**
   * 特定イベントタイプのメトリクス取得
   */
  getEventTypeMetrics(eventType: string) {
    return (
      this.eventMetrics.get(eventType) || {
        count: 0,
        lastEmitted: null,
        totalProcessingTime: 0,
        errorCount: 0
      }
    )
  }

  /**
   * イベントメトリクスの更新
   */
  private updateEventMetrics(eventType: string, timestamp: number): void {
    const metrics = this.eventMetrics.get(eventType) || {
      count: 0,
      lastEmitted: new Date(),
      totalProcessingTime: 0,
      errorCount: 0
    }

    metrics.count++
    metrics.lastEmitted = new Date(timestamp)

    this.eventMetrics.set(eventType, metrics)
  }

  /**
   * 処理時間メトリクスの更新
   */
  private updateProcessingTime(eventType: string, processingTime: number): void {
    const metrics = this.eventMetrics.get(eventType)
    if (metrics) {
      metrics.totalProcessingTime += processingTime
      this.eventMetrics.set(eventType, metrics)
    }
  }

  /**
   * エラーメトリクスの更新
   */
  private updateErrorMetrics(eventType: string): void {
    const metrics = this.eventMetrics.get(eventType)
    if (metrics) {
      metrics.errorCount++
      this.eventMetrics.set(eventType, metrics)
    }
  }

  /**
   * グローバルエラーハンドリング設定
   */
  private setupGlobalErrorHandling(): void {
    // 未処理のイベントエラーをキャッチ
    this.eventEmitter.on('error', (error, eventType) => {
      this.logger.error(`🚨 Global Event Error: ${eventType}`, error)

      // システムエラーイベント発行
      const systemErrorEvent: SystemErrorEvent = {
        type: 'system.error.occurred',
        timestamp: new Date(),
        source: 'system' as const,
        error: {
          code: 'EVENT_PROCESSING_ERROR',
          message: error.message,
          stack: error.stack,
          context: { eventType },
          severity: 'high'
        }
      }
      this.emit(systemErrorEvent)
    })
  }

  /**
   * イベントメトリクスログ出力
   */
  private logEventMetrics(): void {
    this.logger.log('📊 Global Event Bus Metrics:')

    for (const [eventType, metrics] of this.eventMetrics) {
      const avgProcessingTime = metrics.count > 0 ? (metrics.totalProcessingTime / metrics.count).toFixed(2) : '0.00'

      this.logger.log(
        `  ${eventType}: ${metrics.count} events, ` + `avg ${avgProcessingTime}ms, ${metrics.errorCount} errors`
      )
    }
  }
}
