import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Interaction } from 'discord.js'
import { InteractionHandler } from '../handlers/base/interaction-handler.base'
import { PatternMatcherService } from './pattern-matcher.service'

/**
 * ハンドラー統計情報
 */
export interface HandlerStatistics {
  totalHandlers: number
  buttonHandlers: number
  selectHandlers: number
  modalHandlers: number
  executionCounts: Map<string, number>
  errorCounts: Map<string, number>
  unregisteredCounts: Map<string, number>
}

/**
 * インタラクションレジストリサービス
 *
 * 全てのインタラクションハンドラーを管理し、
 * customIdに基づいて適切なハンドラーにルーティングします。
 *
 * 明示登録されたハンドラーによるルーティングを実現します。
 */
@Injectable()
export class InteractionRegistryService implements OnModuleInit {
  private readonly logger = new Logger(InteractionRegistryService.name)

  /** 登録されたハンドラーのリスト */
  private handlers: InteractionHandler[] = []

  /** 実行回数の統計 */
  private executionCounts = new Map<string, number>()

  /** エラー回数の統計 */
  private errorCounts = new Map<string, number>()

  /** 未登録customIdの統計（key: type:customId） */
  private unregisteredCounts = new Map<string, number>()

  /** 初期化完了フラグ */
  private initialized = false

  constructor(private readonly patternMatcher: PatternMatcherService) {}

  /**
   * モジュール初期化時に登録済みハンドラーの状態を確認
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('🚀 Initializing Interaction Registry...')

    try {
      // 競合チェック
      const conflicts = this.patternMatcher.detectConflicts(this.handlers)
      if (conflicts.length > 0) {
        this.logger.warn(`⚠️ Found ${conflicts.length} pattern conflict(s). Check handler patterns.`)
      }

      // サマリー出力
      this.logger.log(this.patternMatcher.generateSummary(this.handlers))
      this.logger.log(`✅ Interaction Registry initialized with ${this.handlers.length} handlers`)
      this.logger.log(`   Button handlers: ${this.getHandlersByType('button').length}`)
      this.logger.log(`   Select handlers: ${this.getHandlersByType('select').length}`)
      this.logger.log(`   Modal handlers: ${this.getHandlersByType('modal').length}`)
      this.initialized = true
    } catch (error) {
      this.logger.error('❌ Failed to initialize Interaction Registry', error)
      throw error
    }
  }

  /**
   * 複数のハンドラーを一括登録
   */
  registerHandlers(handlers: InteractionHandler[]): void {
    for (const handler of handlers) {
      this.registerHandler(handler)
    }
    this.logger.log(`Registered ${handlers.length} handlers via batch registration`)
  }

  /**
   * ハンドラーを手動で登録
   */
  registerHandler(handler: InteractionHandler): void {
    this.handlers.push(handler)
    this.logger.debug(`Registered handler: ${handler.getDescription()}`)
  }

  /**
   * インタラクションをルーティング
   *
   * @param interaction Discord.js インタラクション
   */
  async route(interaction: Interaction): Promise<boolean> {
    // インタラクションタイプを判定
    let interactionType: 'button' | 'select' | 'modal'
    let customId: string

    if (interaction.isButton()) {
      interactionType = 'button'
      customId = interaction.customId
    } else if (interaction.isAnySelectMenu()) {
      interactionType = 'select'
      customId = interaction.customId
    } else if (interaction.isModalSubmit()) {
      interactionType = 'modal'
      customId = interaction.customId
    } else {
      this.logger.debug(`Unsupported interaction type: ${interaction.type}`)
      return false
    }

    // 該当するハンドラーを検索
    const handler = this.findHandler(customId, interactionType)

    if (!handler) {
      this.recordUnregistered(customId, interactionType)
      this.logger.warn(`No handler found for: ${customId} (type: ${interactionType})`)
      return false
    }

    // ハンドラーを実行
    try {
      this.logger.debug(`Routing ${customId} to ${handler.constructor.name}`)
      await handler.execute(interaction as any)

      // 実行回数を記録
      const handlerName = handler.constructor.name
      this.executionCounts.set(handlerName, (this.executionCounts.get(handlerName) || 0) + 1)

      return true
    } catch (error) {
      // エラー回数を記録
      const handlerName = handler.constructor.name
      this.errorCounts.set(handlerName, (this.errorCounts.get(handlerName) || 0) + 1)

      this.logger.error(`Handler execution failed: ${handler.constructor.name}`, error)
      throw error
    }
  }

  /**
   * customIdとタイプに基づいてハンドラーを検索
   */
  private findHandler(
    customId: string,
    interactionType: 'button' | 'select' | 'modal'
  ): InteractionHandler | undefined {
    // 該当タイプのハンドラーのみフィルタ
    const typeHandlers = this.handlers.filter((h) => h.getInteractionType() === interactionType)

    // PatternMatcherで最適なハンドラーを検索
    return this.patternMatcher.findBestMatch(customId, typeHandlers)
  }

  /**
   * タイプ別のハンドラーを取得
   */
  getHandlersByType(type: 'button' | 'select' | 'modal'): InteractionHandler[] {
    return this.handlers.filter((h) => h.getInteractionType() === type)
  }

  /**
   * 全ハンドラーを取得
   */
  getAllHandlers(): InteractionHandler[] {
    return [...this.handlers]
  }

  /**
   * 統計情報を取得
   */
  getStatistics(): HandlerStatistics {
    return {
      totalHandlers: this.handlers.length,
      buttonHandlers: this.getHandlersByType('button').length,
      selectHandlers: this.getHandlersByType('select').length,
      modalHandlers: this.getHandlersByType('modal').length,
      executionCounts: new Map(this.executionCounts),
      errorCounts: new Map(this.errorCounts),
      unregisteredCounts: new Map(this.unregisteredCounts)
    }
  }

  /**
   * 統計情報をリセット
   */
  resetStatistics(): void {
    this.executionCounts.clear()
    this.errorCounts.clear()
    this.unregisteredCounts.clear()
    this.logger.log('Statistics reset')
  }

  /**
   * 特定のcustomIdに対応するハンドラーが存在するか確認
   */
  hasHandler(customId: string, interactionType: 'button' | 'select' | 'modal'): boolean {
    return this.findHandler(customId, interactionType) !== undefined
  }

  /**
   * 初期化完了を確認
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * デバッグ情報を出力
   */
  debugInfo(): void {
    this.logger.log('=== Interaction Registry Debug Info ===')
    this.logger.log(`Initialized: ${this.initialized}`)
    this.logger.log(`Total handlers: ${this.handlers.length}`)
    this.logger.log('')

    for (const handler of this.handlers) {
      const execCount = this.executionCounts.get(handler.constructor.name) || 0
      const errorCount = this.errorCounts.get(handler.constructor.name) || 0
      this.logger.log(`  ${handler.getDescription()}`)
      this.logger.log(`    Executions: ${execCount}, Errors: ${errorCount}`)
    }

    if (this.unregisteredCounts.size > 0) {
      this.logger.log('')
      this.logger.log('Unregistered customId (top 10):')
      const sorted = [...this.unregisteredCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      for (const [key, count] of sorted) {
        this.logger.log(`  ${key} → ${count}`)
      }
    }

    this.logger.log('========================================')
  }

  /**
   * 未登録customIdの統計を記録
   */
  private recordUnregistered(customId: string, interactionType: 'button' | 'select' | 'modal'): void {
    const key = `${interactionType}:${customId}`
    this.unregisteredCounts.set(key, (this.unregisteredCounts.get(key) || 0) + 1)
  }
}
