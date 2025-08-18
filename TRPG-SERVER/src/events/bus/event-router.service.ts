import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { GlobalEventBusService } from './global-event-bus.service'
import { GlobalEventType, getEventCategory, getEventPriority, EVENT_CATEGORIES, EVENT_PRIORITY } from '../contracts'

/**
 * Event Router Service
 * イベントルーティング・振り分け・優先度制御
 */
@Injectable()
export class EventRouterService implements OnModuleInit {
  private readonly logger = new Logger(EventRouterService.name)
  private routingRules = new Map<
    string,
    {
      priority: number
      maxRetries: number
      retryDelay: number
      handlers: string[]
    }
  >()

  constructor(private readonly globalEventBus: GlobalEventBusService) {}

  onModuleInit() {
    this.setupDefaultRoutingRules()
    this.logger.log('Event Router Service initialized')
  }

  /**
   * 優先度付きイベント発行
   */
  async routeEvent<T extends GlobalEventType>(event: T): Promise<boolean> {
    const category = getEventCategory(event.type)
    const priority = getEventPriority(event.type)
    const rule = this.getRoutingRule(event.type)

    this.logger.debug(`🔀 Routing Event: ${event.type} [${category}] Priority: ${priority}`)

    // 優先度に基づく処理遅延
    if (priority === EVENT_PRIORITY.CRITICAL) {
      // 緊急イベントは即座に処理
      return this.processImmediately(event)
    } else if (priority === EVENT_PRIORITY.HIGH) {
      // 高優先度イベントは短遅延で処理
      return this.processWithDelay(event, 10)
    } else {
      // 通常・低優先度イベントは通常処理
      return this.processNormally(event)
    }
  }

  /**
   * バッチイベント発行（複数イベントの効率的処理）
   */
  async routeEventsBatch(events: GlobalEventType[]): Promise<boolean[]> {
    // 優先度でソート（高優先度から処理）
    const sortedEvents = events.sort((a, b) => getEventPriority(b.type) - getEventPriority(a.type))

    this.logger.debug(`🔀 Batch Routing ${events.length} events`)

    const results = []

    // 順次処理（優先度順）
    for (const event of sortedEvents) {
      try {
        const result = await this.routeEvent(event)
        results.push(result)
      } catch (error) {
        this.logger.error(`❌ Batch routing failed for ${event.type}`, error)
        results.push(false)
      }
    }

    return results
  }

  /**
   * 条件付きイベントルーティング
   */
  async routeEventConditionally<T extends GlobalEventType>(
    event: T,
    condition: (event: T) => boolean
  ): Promise<boolean> {
    if (!condition(event)) {
      this.logger.debug(`⏭️ Event skipped by condition: ${event.type}`)
      return false
    }

    return this.routeEvent(event)
  }

  /**
   * リトライ付きイベント発行
   */
  async routeEventWithRetry<T extends GlobalEventType>(event: T, maxRetries: number = 3): Promise<boolean> {
    const rule = this.getRoutingRule(event.type)
    const retries = maxRetries || rule.maxRetries

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.routeEvent(event)
        if (result) {
          if (attempt > 1) {
            this.logger.log(`✅ Event succeeded on attempt ${attempt}: ${event.type}`)
          }
          return result
        }
      } catch (error) {
        this.logger.warn(`⚠️ Event attempt ${attempt}/${retries} failed: ${event.type}`, error)

        if (attempt < retries) {
          // 指数バックオフで待機
          const delay = rule.retryDelay * Math.pow(2, attempt - 1)
          await this.sleep(delay)
        }
      }
    }

    this.logger.error(`❌ Event failed after ${retries} attempts: ${event.type}`)
    return false
  }

  /**
   * ルーティングルール設定
   */
  setRoutingRule(
    eventType: string,
    rule: {
      priority?: number
      maxRetries?: number
      retryDelay?: number
      handlers?: string[]
    }
  ): void {
    const existingRule = this.routingRules.get(eventType) || {
      priority: EVENT_PRIORITY.NORMAL,
      maxRetries: 3,
      retryDelay: 1000,
      handlers: []
    }

    const newRule = { ...existingRule, ...rule }
    this.routingRules.set(eventType, newRule)

    this.logger.debug(`📝 Routing rule updated: ${eventType}`)
  }

  /**
   * ルーティング統計取得
   */
  getRoutingStats() {
    const eventMetrics = this.globalEventBus.getEventMetrics()
    const stats = {
      totalEvents: 0,
      eventsByCategory: {
        [EVENT_CATEGORIES.CHARACTER]: 0,
        [EVENT_CATEGORIES.DISCORD]: 0,
        [EVENT_CATEGORIES.SYSTEM]: 0
      },
      eventsByPriority: {
        [EVENT_PRIORITY.LOW]: 0,
        [EVENT_PRIORITY.NORMAL]: 0,
        [EVENT_PRIORITY.HIGH]: 0,
        [EVENT_PRIORITY.CRITICAL]: 0
      }
    }

    for (const [eventType, metrics] of eventMetrics) {
      stats.totalEvents += metrics.count

      const category = getEventCategory(eventType)
      const priority = getEventPriority(eventType)

      if (category && stats.eventsByCategory[category] !== undefined) {
        stats.eventsByCategory[category] += metrics.count
      }

      stats.eventsByPriority[priority] += metrics.count
    }

    return stats
  }

  /**
   * 即座処理（緊急イベント）
   */
  private async processImmediately<T extends GlobalEventType>(event: T): Promise<boolean> {
    this.logger.warn(`🚨 CRITICAL Event Processing: ${event.type}`)
    return this.globalEventBus.emit(event)
  }

  /**
   * 遅延処理（高優先度イベント）
   */
  private async processWithDelay<T extends GlobalEventType>(event: T, delayMs: number): Promise<boolean> {
    if (delayMs > 0) {
      await this.sleep(delayMs)
    }
    return this.globalEventBus.emit(event)
  }

  /**
   * 通常処理
   */
  private async processNormally<T extends GlobalEventType>(event: T): Promise<boolean> {
    return this.globalEventBus.emit(event)
  }

  /**
   * ルーティングルール取得
   */
  private getRoutingRule(eventType: string) {
    return (
      this.routingRules.get(eventType) || {
        priority: getEventPriority(eventType),
        maxRetries: 3,
        retryDelay: 1000,
        handlers: []
      }
    )
  }

  /**
   * デフォルトルーティングルール設定
   */
  private setupDefaultRoutingRules(): void {
    // 緊急イベントルール
    this.setRoutingRule('system.error.occurred', {
      priority: EVENT_PRIORITY.CRITICAL,
      maxRetries: 5,
      retryDelay: 500
    })

    this.setRoutingRule('discord.integration.error', {
      priority: EVENT_PRIORITY.CRITICAL,
      maxRetries: 5,
      retryDelay: 500
    })

    // 高優先度イベントルール
    this.setRoutingRule('character.creation.requested', {
      priority: EVENT_PRIORITY.HIGH,
      maxRetries: 3,
      retryDelay: 1000
    })

    this.setRoutingRule('discord.channel.create.requested', {
      priority: EVENT_PRIORITY.HIGH,
      maxRetries: 3,
      retryDelay: 2000
    })
  }

  /**
   * スリープユーティリティ
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
