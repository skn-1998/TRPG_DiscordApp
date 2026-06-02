import { Injectable, Logger, Inject } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { EventName, EventPayload, TypedEventHandler, TypedEventListener } from '../../events/contracts'

/**
 * 型安全なイベントサービス
 * EventEmitter2をラップして型安全性を提供
 */
@Injectable()
export class TypedEventService {
  private readonly logger = new Logger(TypedEventService.name)

  /**
   * `on()` で登録した元 handler と、実際に EventEmitter2 へ登録したラッパー関数の対応表。
   * `off()` で元 handler から正しいラッパーを引いて解除するために保持する。
   * 構造: event 名 → (元 handler → ラッパー配列)。
   * 同一 handler の複数登録に対応するため値は配列とし、`off()` は1回につき1ラッパーのみ解除する。
   */

  private readonly handlerWrappers = new Map<string, Map<(...args: any[]) => any, Array<(...args: any[]) => any>>>()

  constructor(@Inject('TYPED_EVENT_EMITTER') private readonly eventEmitter: EventEmitter2) {}

  /**
   * 型安全なイベント発行
   * @param event イベント名（型安全）
   * @param payload イベント引数（型安全）
   */
  async emit<T extends EventName>(event: T, payload: EventPayload<T>): Promise<void> {
    this.logger.log(`[TYPED-EVENT] Emitting event: ${event}`)
    this.logger.debug(`[TYPED-EVENT] Payload:`, payload)

    // 基本的なペイロードバリデーション
    this.validatePayload(event, payload)

    // EventEmitter2でイベント発行
    await this.eventEmitter.emitAsync(event, payload)

    this.logger.log(`[TYPED-EVENT] Event emitted successfully: ${event}`)
  }

  /**
   * 型安全なイベントリスナー登録
   * @param event イベント名（型安全）
   * @param handler イベントハンドラー（型安全）
   */
  on<T extends EventName>(event: T, handler: TypedEventHandler<T>): void {
    this.logger.log(`[TYPED-EVENT] Registering handler for event: ${event}`)

    const wrapper = async (payload: EventPayload<T>) => {
      this.logger.debug(`[TYPED-EVENT] Handling event: ${event}`)

      try {
        await handler(payload)
        this.logger.debug(`[TYPED-EVENT] Event handled successfully: ${event}`)
      } catch (error) {
        this.logger.error(`[TYPED-EVENT] Error handling event ${event}:`, error)
        throw error
      }
    }

    // off() で解除できるよう、元 handler → ラッパーの対応を記録してから登録する
    this.trackWrapper(event, handler, wrapper)
    this.eventEmitter.on(event, wrapper)
  }

  /**
   * 型安全なワンタイムイベントリスナー登録
   * @param event イベント名（型安全）
   * @param handler イベントハンドラー（型安全）
   */
  once<T extends EventName>(event: T, handler: TypedEventHandler<T>): void {
    this.logger.log(`[TYPED-EVENT] Registering one-time handler for event: ${event}`)

    this.eventEmitter.once(event, async (payload: EventPayload<T>) => {
      this.logger.debug(`[TYPED-EVENT] Handling one-time event: ${event}`)

      try {
        await handler(payload)
        this.logger.debug(`[TYPED-EVENT] One-time event handled successfully: ${event}`)
      } catch (error) {
        this.logger.error(`[TYPED-EVENT] Error handling one-time event ${event}:`, error)
        throw error
      }
    })
  }

  /**
   * イベントリスナーの削除
   * @param event イベント名（型安全）
   * @param handler イベントハンドラー（型安全）
   */
  off<T extends EventName>(event: T, handler: TypedEventHandler<T>): void {
    this.logger.log(`[TYPED-EVENT] Removing handler for event: ${event}`)

    const wrapper = this.takeWrapper(event, handler)
    if (!wrapper) {
      // on() 経由で登録されていない handler の off は no-op（多重 off や未登録 off を安全に無視）
      this.logger.debug(`[TYPED-EVENT] No registered wrapper found for event: ${event}`)
      return
    }

    this.eventEmitter.off(event, wrapper)
  }

  /**
   * 複数のイベントリスナーを一括登録
   * @param listeners イベントリスナーの配列
   */

  registerMultiple(listeners: TypedEventListener<any>[]): void {
    this.logger.log(`[TYPED-EVENT] Registering ${listeners.length} event listeners`)

    listeners.forEach(({ event, handler }) => {
      this.on(event, handler)
    })
  }

  /**
   * 特定のイベントのすべてのリスナーを削除
   * @param event イベント名（型安全）
   */
  removeAllListeners<T extends EventName>(event: T): void {
    this.logger.log(`[TYPED-EVENT] Removing all listeners for event: ${event}`)
    this.eventEmitter.removeAllListeners(event)
    // 解除済みラッパーが対応表に残らないよう同時にクリアする
    this.handlerWrappers.delete(event)
  }

  /**
   * on() 登録時に元 handler → ラッパーの対応を記録する
   */

  private trackWrapper(event: string, handler: (...args: any[]) => any, wrapper: (...args: any[]) => any): void {
    let byHandler = this.handlerWrappers.get(event)
    if (!byHandler) {
      byHandler = new Map()
      this.handlerWrappers.set(event, byHandler)
    }
    const wrappers = byHandler.get(handler) ?? []
    wrappers.push(wrapper)
    byHandler.set(handler, wrappers)
  }

  /**
   * off() 用に元 handler に対応するラッパーを1つ取り出す（取り出したものは対応表から除去）。
   * 同一 handler が複数登録されている場合は最後に登録したものから解除する。
   * 対応するラッパーが無ければ undefined を返す。
   */

  private takeWrapper(event: string, handler: (...args: any[]) => any): ((...args: any[]) => any) | undefined {
    const byHandler = this.handlerWrappers.get(event)
    const wrappers = byHandler?.get(handler)
    if (!byHandler || !wrappers || wrappers.length === 0) {
      return undefined
    }

    const wrapper = wrappers.pop()
    if (wrappers.length === 0) {
      byHandler.delete(handler)
      if (byHandler.size === 0) {
        this.handlerWrappers.delete(event)
      }
    }
    return wrapper
  }

  /**
   * イベントの発行を待機（Promise化）
   * @param event 待機するイベント名（型安全）
   * @param timeout タイムアウト（ミリ秒）
   * @returns イベントペイロード
   */
  async waitForEvent<T extends EventName>(event: T, timeout = 5000): Promise<EventPayload<T>> {
    this.logger.log(`[TYPED-EVENT] Waiting for event: ${event} (timeout: ${timeout}ms)`)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.logger.error(`[TYPED-EVENT] Event wait timeout: ${event}`)
        reject(new Error(`Event ${event} timeout after ${timeout}ms`))
      }, timeout)

      this.once(event, (payload: EventPayload<T>) => {
        clearTimeout(timer)
        this.logger.log(`[TYPED-EVENT] Event received: ${event}`)
        resolve(payload)
      })
    })
  }

  /**
   * 基本的なペイロードバリデーション
   * @param event イベント名
   * @param payload ペイロード
   */
  private validatePayload<T extends EventName>(event: T, payload: EventPayload<T>): void {
    if (!payload) {
      throw new Error(`[TYPED-EVENT] Payload is required for event: ${event}`)
    }

    if (typeof payload !== 'object') {
      throw new Error(`[TYPED-EVENT] Payload must be an object for event: ${event}`)
    }

    // 共通フィールドのバリデーション
    if ('source' in payload && typeof payload.source !== 'string') {
      throw new Error(`[TYPED-EVENT] Source must be a string for event: ${event}`)
    }

    if ('timestamp' in payload && !(payload.timestamp instanceof Date)) {
      throw new Error(`[TYPED-EVENT] Timestamp must be a Date for event: ${event}`)
    }
  }
}

/**
 * 型安全なイベント発行のためのヘルパー関数
 */
export class TypedEventEmitter {
  constructor(private readonly typedEventService: TypedEventService) {}

  /**
   * Character検索リクエストイベント
   */
  async requestCharacterSearch(channelId: string, source: string, tabType?: string): Promise<void> {
    await this.typedEventService.emit('character.findByChannelId.requested', {
      channelId,
      source,
      timestamp: new Date(),
      tabType
    })
  }

  /**
   * Character更新リクエストイベント
   */
  async requestCharacterUpdate(
    channelId: string,
    updateData: EventPayload<'character.update.requested'>['updateData'],
    source: string,
    userId?: string
  ): Promise<void> {
    await this.typedEventService.emit('character.update.requested', {
      channelId,
      updateData,
      userId,
      source,
      timestamp: new Date()
    })
  }

  /**
   * Character作成リクエストイベント
   */
  async requestCharacterCreation(
    createData: EventPayload<'character.creation.requested'>['createData'],
    userId: string,
    source: string
  ): Promise<void> {
    await this.typedEventService.emit('character.creation.requested', {
      createData,
      userId,
      source,
      timestamp: new Date()
    })
  }

  /**
   * DiceRoll実行リクエストイベント
   */
  async requestDiceRoll(channelId: string, diceExpression: string, userId: string, source: string): Promise<void> {
    await this.typedEventService.emit('diceroll.execute.requested', {
      channelId,
      diceExpression,
      userId,
      source,
      timestamp: new Date()
    })
  }

  // 🚨 REMOVED: requestDiscordCharacterEmbedUpdate メソッドを削除
  // File-based Event Handlersがcharacter.update.completedイベントを自動処理するため不要

  /**
   * ChannelIDによるキャラクター検索リクエストイベント
   */
  async requestCharacterByChannelId(channelId: string, source: string, tabType?: string): Promise<void> {
    await this.typedEventService.emit('character.findByChannelId.requested', {
      channelId,
      source,
      timestamp: new Date(),
      tabType
    })
  }

  /**
   * キャラクターIDによるキャラクター検索リクエストイベント
   */
  async requestCharacterById(characterId: string, source: string): Promise<void> {
    await this.typedEventService.emit('character.findById.requested', {
      characterId,
      source,
      timestamp: new Date()
    })
  }

  /**
   * キャラクター名による検索リクエストイベント
   */
  async requestCharacterByName(characterName: string, source: string): Promise<void> {
    await this.typedEventService.emit('character.findByName.requested', {
      characterName,
      source,
      timestamp: new Date()
    })
  }
}
