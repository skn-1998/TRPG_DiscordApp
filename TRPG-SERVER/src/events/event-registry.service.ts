import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { TypedEventService } from '../shared/application/typed-event.service'
import { EventHandler, EventContext } from './handlers/_shared/event-handler.base'
import { CharacterEventContracts } from '../shared/domain/events/event-contracts'

// ハンドラーのインポート
import { CharacterCreationRequestedHandler } from './handlers/character.creation.requested'
import { CharacterUpdateRequestedHandler } from './handlers/character.update.requested'
import { CharacterFindByChannelIdRequestedHandler } from './handlers/character.findByChannelId.requested'
import { CharacterFindByIdRequestedHandler } from './handlers/character.findById.requested'
import { CharacterCreationCompletedHandler } from './handlers/character.creation.completed'
import { CharacterUpdateCompletedHandler } from './handlers/character.update.completed'
import { CharacterDeletionCompletedHandler } from './handlers/character.deletion.completed'
import { CharacterFindByNameRequestedHandler } from './handlers/character.findByName.requested'

/**
 * File-based Event Registry Service
 *
 * 🎯 責務:
 * - 全ハンドラーの自動登録
 * - イベント名とハンドラーのマッピング管理
 * - 実行時のルーティング
 * - ハンドラーの健全性チェック
 *
 * 🏗️ アーキテクチャ:
 * - Remix.js風のファイルベースルーティング
 * - 型安全なイベントハンドリング
 * - 自動検出とマニフェスト生成
 */
@Injectable()
export class EventRegistryService implements OnModuleInit {
  private readonly logger = new Logger(EventRegistryService.name)
  private handlers = new Map<string, EventHandler>()
  private eventStats = new Map<string, EventStatistics>()

  constructor(
    private readonly typedEventService: TypedEventService,
    // 各ハンドラーを注入（NestJS DIによる自動解決）
    private readonly characterCreationHandler: CharacterCreationRequestedHandler,
    private readonly characterUpdateHandler: CharacterUpdateRequestedHandler,
    private readonly characterFindByChannelIdHandler: CharacterFindByChannelIdRequestedHandler,
    private readonly characterFindByIdHandler: CharacterFindByIdRequestedHandler,
    private readonly characterCreationCompletedHandler: CharacterCreationCompletedHandler,
    private readonly characterUpdateCompletedHandler: CharacterUpdateCompletedHandler,
    private readonly characterDeletionCompletedHandler: CharacterDeletionCompletedHandler,
    private readonly characterFindByNameHandler: CharacterFindByNameRequestedHandler
    // 新しいハンドラーはここに追加
  ) {}

  /**
   * モジュール初期化: 全ハンドラーの自動登録
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('🚀 Initializing File-based Event Registry...')

    await this.registerAllHandlers()
    await this.validateHandlerIntegrity()
    await this.logRegistryStatus()

    this.logger.log('✅ File-based Event Registry initialized successfully')
  }

  /**
   * 全ハンドラーの一括登録
   */
  private async registerAllHandlers(): Promise<void> {
    // 登録対象ハンドラー一覧
    const handlersToRegister = [
      this.characterCreationHandler,
      this.characterUpdateHandler,
      this.characterFindByChannelIdHandler,
      this.characterFindByIdHandler,
      this.characterCreationCompletedHandler,
      this.characterUpdateCompletedHandler,
      this.characterDeletionCompletedHandler,
      this.characterFindByNameHandler
      // 新しいハンドラーはここに追加
    ]

    let successCount = 0
    let errorCount = 0

    for (const handler of handlersToRegister) {
      try {
        await this.registerHandler(handler)
        successCount++
      } catch (error) {
        this.logger.error(`Failed to register handler: ${handler.constructor.name}`, error)
        errorCount++
      }
    }

    this.logger.log(`📋 Handler Registration Summary: ${successCount} succeeded, ${errorCount} failed`)
  }

  /**
   * 個別ハンドラーの登録
   */
  private async registerHandler(handler: EventHandler): Promise<void> {
    const eventName = handler.getEventName()

    // 重複チェック
    if (this.handlers.has(eventName)) {
      throw new Error(`Event handler already registered for: ${eventName}`)
    }

    // ハンドラーの健全性チェック
    await this.validateHandler(handler, eventName)

    // TypedEventServiceをハンドラーに設定
    handler.setTypedEventService(this.typedEventService)

    // ハンドラーマップに登録
    this.handlers.set(eventName, handler)

    // TypedEventService にリスナー登録
    this.typedEventService.on(eventName as keyof CharacterEventContracts, async (event) => {
      await this.executeHandler(eventName, event)
    })

    // 統計情報初期化
    this.eventStats.set(eventName, {
      totalExecutions: 0,
      successCount: 0,
      errorCount: 0,
      averageExecutionTime: 0,
      lastExecuted: null,
      lastError: null
    })

    this.logger.debug(`✅ Registered handler: ${eventName} → ${handler.constructor.name}`)
  }

  /**
   * ハンドラーの健全性チェック
   */
  private async validateHandler(handler: EventHandler, eventName: string): Promise<void> {
    // 必須メソッドの存在チェック
    if (typeof handler.getEventName !== 'function') {
      throw new Error(`Handler ${handler.constructor.name} missing getEventName() method`)
    }

    if (typeof handler.handle !== 'function') {
      throw new Error(`Handler ${handler.constructor.name} missing handle() method`)
    }

    // イベント名の一貫性チェック
    const handlerEventName = handler.getEventName()
    if (handlerEventName !== eventName) {
      throw new Error(`Handler event name mismatch: expected ${eventName}, got ${handlerEventName}`)
    }

    // イベント名形式チェック
    if (!this.isValidEventName(eventName)) {
      throw new Error(`Invalid event name format: ${eventName}`)
    }
  }

  /**
   * イベント名形式の検証
   */
  private isValidEventName(eventName: string): boolean {
    // ドット記法の検証: domain.action.type（キャメルケース許可）
    const pattern = /^[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/
    return pattern.test(eventName)
  }

  /**
   * ハンドラー実行（統計情報収集付き）
   */
  private async executeHandler(eventName: string, event: any): Promise<void> {
    const handler = this.handlers.get(eventName)
    if (!handler) {
      this.logger.error(`No handler found for event: ${eventName}`)
      return
    }

    const stats = this.eventStats.get(eventName)!
    const startTime = Date.now()

    try {
      // コンテキスト情報の拡張
      const context: EventContext = {
        correlationId: event.correlationId || this.generateCorrelationId(),
        source: event.source || 'unknown',
        timestamp: new Date(),
        handlerName: handler.constructor.name,
        eventName
      }

      // ハンドラー実行
      await handler.execute(event, context)

      // 成功統計更新
      const duration = Date.now() - startTime
      this.updateSuccessStats(stats, duration)

      this.logger.debug(`✅ Handler executed successfully: ${eventName} (${duration}ms)`)
    } catch (error) {
      // エラー統計更新
      const duration = Date.now() - startTime
      this.updateErrorStats(stats, error as Error, duration)

      this.logger.error(`❌ Handler execution failed: ${eventName} (${duration}ms)`, error)

      // エラーを再スローして呼び出し元に伝播
      throw error
    }
  }

  /**
   * 成功統計の更新
   */
  private updateSuccessStats(stats: EventStatistics, duration: number): void {
    stats.totalExecutions++
    stats.successCount++
    stats.lastExecuted = new Date()

    // 平均実行時間の更新（移動平均）
    if (stats.averageExecutionTime === 0) {
      stats.averageExecutionTime = duration
    } else {
      stats.averageExecutionTime = stats.averageExecutionTime * 0.8 + duration * 0.2
    }
  }

  /**
   * エラー統計の更新
   */
  private updateErrorStats(stats: EventStatistics, error: Error, duration: number): void {
    stats.totalExecutions++
    stats.errorCount++
    stats.lastExecuted = new Date()
    stats.lastError = {
      message: error.message,
      name: error.name,
      timestamp: new Date()
    }
  }

  /**
   * 相関IDの生成
   */
  private generateCorrelationId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 登録済みハンドラーの整合性チェック
   */
  private async validateHandlerIntegrity(): Promise<void> {
    const issues: string[] = []

    // 重複チェック
    const eventNames = Array.from(this.handlers.keys())
    const duplicates = eventNames.filter((name, index) => eventNames.indexOf(name) !== index)
    if (duplicates.length > 0) {
      issues.push(`Duplicate event handlers: ${duplicates.join(', ')}`)
    }

    // 命名規約チェック
    this.handlers.forEach((handler, eventName) => {
      if (!this.isValidEventName(eventName)) {
        issues.push(`Invalid event name: ${eventName}`)
      }
    })

    if (issues.length > 0) {
      this.logger.warn(`⚠️ Handler integrity issues found: ${issues.join('; ')}`)
    } else {
      this.logger.debug('✅ Handler integrity validation passed')
    }
  }

  /**
   * レジストリ状態のログ出力
   */
  private async logRegistryStatus(): Promise<void> {
    const handlerCount = this.handlers.size
    const eventNames = Array.from(this.handlers.keys()).sort()

    this.logger.log(`📊 Registry Status: ${handlerCount} handlers registered`)
    this.logger.debug(`📋 Registered events: ${eventNames.join(', ')}`)

    // ハンドラー別の詳細情報
    eventNames.forEach((eventName) => {
      const handler = this.handlers.get(eventName)!
      this.logger.debug(`  📌 ${eventName} → ${handler.constructor.name}`)
    })
  }

  // ===== Public API =====

  /**
   * 特定イベントのハンドラー取得
   */
  getHandler(eventName: string): EventHandler | undefined {
    return this.handlers.get(eventName)
  }

  /**
   * 全ハンドラーのマップ取得
   */
  getAllHandlers(): Map<string, EventHandler> {
    return new Map(this.handlers)
  }

  /**
   * 登録済みイベント名一覧取得
   */
  getRegisteredEventNames(): string[] {
    return Array.from(this.handlers.keys()).sort()
  }

  /**
   * イベント統計情報取得
   */
  getEventStatistics(eventName?: string): Map<string, EventStatistics> | EventStatistics | undefined {
    if (eventName) {
      return this.eventStats.get(eventName)
    }
    return new Map(this.eventStats)
  }

  /**
   * レジストリ健全性レポート取得
   */
  getHealthReport(): RegistryHealthReport {
    const totalHandlers = this.handlers.size
    const totalExecutions = Array.from(this.eventStats.values()).reduce((sum, stats) => sum + stats.totalExecutions, 0)
    const totalErrors = Array.from(this.eventStats.values()).reduce((sum, stats) => sum + stats.errorCount, 0)

    const errorRate = totalExecutions > 0 ? totalErrors / totalExecutions : 0
    const averageExecutionTime = this.calculateOverallAverageExecutionTime()

    return {
      totalHandlers,
      totalExecutions,
      totalErrors,
      errorRate,
      averageExecutionTime,
      healthStatus: errorRate < 0.05 ? 'healthy' : errorRate < 0.15 ? 'warning' : 'critical',
      lastUpdated: new Date()
    }
  }

  /**
   * 全体平均実行時間の計算
   */
  private calculateOverallAverageExecutionTime(): number {
    const stats = Array.from(this.eventStats.values()).filter((s) => s.averageExecutionTime > 0)

    if (stats.length === 0) return 0

    return stats.reduce((sum, s) => sum + s.averageExecutionTime, 0) / stats.length
  }
}

/**
 * イベント統計情報
 */
interface EventStatistics {
  totalExecutions: number
  successCount: number
  errorCount: number
  averageExecutionTime: number
  lastExecuted: Date | null
  lastError: {
    message: string
    name: string
    timestamp: Date
  } | null
}

/**
 * レジストリ健全性レポート
 */
interface RegistryHealthReport {
  totalHandlers: number
  totalExecutions: number
  totalErrors: number
  errorRate: number
  averageExecutionTime: number
  healthStatus: 'healthy' | 'warning' | 'critical'
  lastUpdated: Date
}
