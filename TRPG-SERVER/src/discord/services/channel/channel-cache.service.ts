import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional, Inject } from '@nestjs/common'
import { Client, TextChannel, NewsChannel, ThreadChannel, Message } from 'discord.js'
import { ErrorHandler } from '../../../utils/error-handler'
import { AppConfigService } from '../../../config/config.service'
import {
  CacheEntryMeta,
  CacheStats,
  computeCacheStats,
  extractTimestampFromSnowflake,
  isCacheEntryFresh,
  isSnowflakeParsable,
  selectExpiredChannelIds,
  selectOldestChannelId
} from './channel-cache.pure'

/** 時刻源 seam（テスト時に差し替え可能）。既定は Date.now。 */
export type Clock = () => number

/**
 * 時刻源を注入するための DI トークン（Clock seam）。
 * 本番では未提供 → 既定で Date.now を使う。テストでは provider で固定時刻を注入できる。
 */
export const CHANNEL_CACHE_CLOCK = Symbol('CHANNEL_CACHE_CLOCK')

/**
 * 定期クリーンアップの自動起動可否を注入する DI トークン（Timer seam）。
 * 本番では未提供 → 既定 true で従来どおり setInterval が動く。
 * テストでは false を注入すれば常駐タイマーを起動しない。
 */
export const CHANNEL_CACHE_AUTO_START_CLEANUP = Symbol('CHANNEL_CACHE_AUTO_START_CLEANUP')

/**
 * チャンネルキャッシュ管理サービス
 *
 * 責務：
 * - チャンネル情報のキャッシュ管理
 * - メッセージキャッシュの最適化
 * - パフォーマンス向上とメモリ効率化
 *
 * テスタビリティ:
 * - キャッシュの判断ロジック（TTL/LRU/stats/snowflake 変換）は副作用のない純関数
 *   （channel-cache.pure.ts）へ委譲。
 * - 時刻取得は Clock seam（既定 Date.now）。
 * - 定期クリーンアップの setInterval は onModuleInit へ移し、オプションで起動を制御。
 *   本番挙動（定期クリーンアップ）は不変。
 */
@Injectable()
export class ChannelCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelCacheService.name)

  // チャンネルキャッシュ（パフォーマンス最適化）
  private channelCache = new Map<
    string,
    {
      channel: TextChannel | NewsChannel | ThreadChannel
      lastAccess: number
      messageCache: Map<string, Message>
    }
  >()

  // キャッシュ設定（環境変数から動的設定）
  private readonly CACHE_TTL: number
  private readonly MESSAGE_CACHE_LIMIT: number
  private readonly MAX_CHANNEL_CACHE: number

  // seam: 時刻源とクリーンアップタイマー
  private readonly now: Clock
  private readonly autoStartCleanup: boolean
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly appConfigService: AppConfigService,
    @Optional() @Inject(CHANNEL_CACHE_CLOCK) clock?: Clock,
    @Optional() @Inject(CHANNEL_CACHE_AUTO_START_CLEANUP) autoStartCleanup?: boolean
  ) {
    // 型安全な設定値を使用（既定値は config 層に集約済み）
    this.CACHE_TTL = this.appConfigService.get('discord.cacheTtl') // 5分
    this.MESSAGE_CACHE_LIMIT = this.appConfigService.get('discord.messageCacheLimit') // メモリ効率化
    this.MAX_CHANNEL_CACHE = this.appConfigService.get('discord.channelCacheLimit') // メモリ効率化

    this.now = clock ?? Date.now
    this.autoStartCleanup = autoStartCleanup ?? true

    this.logger.debug(
      `Channel cache service initialized with limits: ${this.MAX_CHANNEL_CACHE} channels, ${this.MESSAGE_CACHE_LIMIT} messages/channel`
    )
  }

  /**
   * NestJS ライフサイクル: 定期クリーンアップを起動する。
   * 本番では従来どおり setInterval によるクリーンアップが動く。
   */
  onModuleInit(): void {
    if (this.autoStartCleanup) {
      this.startCleanupTimer()
    }
  }

  /**
   * NestJS ライフサイクル: 常駐タイマーを停止しリークを防ぐ。
   */
  onModuleDestroy(): void {
    this.stopCleanupTimer()
  }

  /**
   * 定期的なキャッシュクリーンアップタイマーを起動（最大1分間隔）。
   * テストからは呼ばずに済むよう public ではなく分離したメソッドにしている。
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return
    }
    this.cleanupTimer = setInterval(
      () => {
        this.cleanupExpiredCache()
      },
      Math.min(this.CACHE_TTL / 2, 60000)
    )
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /** 純関数へ渡すためのメタ情報スナップショットを生成する（副作用なしの読み取り） */
  private snapshotEntries(): CacheEntryMeta[] {
    const entries: CacheEntryMeta[] = []
    for (const [id, cached] of this.channelCache.entries()) {
      entries.push({ id, lastAccess: cached.lastAccess, messageCacheSize: cached.messageCache.size })
    }
    return entries
  }

  /**
   * チャンネルを取得（キャッシュ優先）
   */
  async getChannel(client: Client, channelId: string): Promise<TextChannel | NewsChannel | ThreadChannel | null> {
    try {
      // キャッシュから取得を試行（TTL 判定は純関数に委譲）
      const cached = this.channelCache.get(channelId)
      if (cached && isCacheEntryFresh(cached.lastAccess, this.now(), this.CACHE_TTL)) {
        cached.lastAccess = this.now()
        this.logger.debug(`Channel retrieved from cache: ${channelId}`)
        return cached.channel
      }

      // キャッシュにない場合はDiscord APIから取得
      const channel = await this.fetchChannel(client, channelId)

      if (!channel?.isTextBased()) {
        this.logger.warn(`Channel ${channelId} is not text-based`)
        return null
      }

      const textChannel = channel as TextChannel | NewsChannel | ThreadChannel

      // キャッシュに保存
      this.updateChannelCache(textChannel)

      this.logger.debug(`Channel fetched from API and cached: ${channelId}`)
      return textChannel
    } catch (error) {
      this.logger.error(`Failed to get channel: ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          operation: 'getChannel'
        },
        'ChannelCacheService'
      )

      return null
    }
  }

  /**
   * Discord API からチャンネルを取得する I/O seam。
   * テストではこのメソッドのみ差し替えればキャッシュ判断ロジックを検証できる。
   */
  protected fetchChannel(client: Client, channelId: string) {
    return client.channels.fetch(channelId)
  }

  /**
   * チャンネルキャッシュを更新
   */
  private updateChannelCache(channel: TextChannel | NewsChannel | ThreadChannel): void {
    try {
      // キャッシュサイズ制限チェック（LRU eviction）
      if (this.channelCache.size >= this.MAX_CHANNEL_CACHE) {
        this.evictOldestCacheEntry()
      }

      this.channelCache.set(channel.id, {
        channel,
        lastAccess: this.now(),
        messageCache: new Map()
      })

      this.logger.debug(`Channel cache updated: ${channel.id}`)
    } catch (error) {
      this.logger.error(`Failed to update channel cache: ${channel.id}`, error)
    }
  }

  /**
   * メッセージをキャッシュから取得
   */
  async getMessageFromCache(channelId: string, messageId: string): Promise<Message | null> {
    try {
      const cached = this.channelCache.get(channelId)
      if (!cached) {
        return null
      }

      const message = cached.messageCache.get(messageId)
      if (message) {
        this.logger.debug(`Message retrieved from cache: ${messageId}`)
        return message
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to get message from cache: ${messageId}`, error)
      return null
    }
  }

  /**
   * メッセージをキャッシュに追加
   */
  addMessageToCache(channelId: string, message: Message): void {
    try {
      const cached = this.channelCache.get(channelId)
      if (!cached) {
        return
      }

      // メッセージキャッシュサイズ制限
      if (cached.messageCache.size >= this.MESSAGE_CACHE_LIMIT) {
        // 最も古いメッセージを削除
        const oldestKey = cached.messageCache.keys().next().value
        if (oldestKey) {
          cached.messageCache.delete(oldestKey)
        }
      }

      cached.messageCache.set(message.id, message)
      this.logger.debug(`Message added to cache: ${message.id} in channel ${channelId}`)
    } catch (error) {
      this.logger.error(`Failed to add message to cache: ${message.id}`, error)
    }
  }

  /**
   * メッセージをキャッシュから削除
   */
  removeMessageFromCache(channelId: string, messageId: string): void {
    try {
      const cached = this.channelCache.get(channelId)
      if (cached) {
        cached.messageCache.delete(messageId)
        this.logger.debug(`Message removed from cache: ${messageId}`)
      }
    } catch (error) {
      this.logger.error(`Failed to remove message from cache: ${messageId}`, error)
    }
  }

  /**
   * 期限切れキャッシュのクリーンアップ
   * 期限切れ判定（純関数）と Map 削除（副作用）を分離。
   */
  private cleanupExpiredCache(): void {
    try {
      const expiredChannels = selectExpiredChannelIds(this.snapshotEntries(), this.now(), this.CACHE_TTL)

      for (const channelId of expiredChannels) {
        this.channelCache.delete(channelId)
      }

      if (expiredChannels.length > 0) {
        this.logger.debug(`Cleaned up ${expiredChannels.length} expired cache entries`)
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired cache', error)
    }
  }

  /**
   * 最も古いキャッシュエントリを削除
   * eviction 対象選定（純関数）と Map 削除（副作用）を分離。
   */
  private evictOldestCacheEntry(): void {
    try {
      const oldestChannelId = selectOldestChannelId(this.snapshotEntries())

      if (oldestChannelId) {
        this.channelCache.delete(oldestChannelId)
        this.logger.debug(`Evicted oldest cache entry: ${oldestChannelId}`)
      }
    } catch (error) {
      this.logger.error('Failed to evict oldest cache entry', error)
    }
  }

  /**
   * Snowflakeからタイムスタンプを抽出
   * 純関数に委譲し、失敗時のフォールバック now のみ注入する。
   * 現挙動踏襲: 不正入力時はログを残しつつ now を返す。
   */
  extractTimestampFromSnowflake(snowflake: string): number {
    const fallbackNow = this.now()
    const result = extractTimestampFromSnowflake(snowflake, fallbackNow)
    if (result === fallbackNow && !isSnowflakeParsable(snowflake)) {
      this.logger.error(`Failed to extract timestamp from snowflake: ${snowflake}`)
    }
    return result
  }

  /**
   * キャッシュ統計情報を取得
   * 集計は純関数（computeCacheStats）に委譲。
   */
  getCacheStats(): CacheStats {
    try {
      return computeCacheStats(this.snapshotEntries())
    } catch (error) {
      this.logger.error('Failed to get cache stats', error)
      return {
        channelCacheSize: 0,
        totalMessagesCached: 0,
        oldestCacheEntry: null,
        newestCacheEntry: null,
        memoryUsageEstimate: 0
      }
    }
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    try {
      const size = this.channelCache.size
      this.channelCache.clear()
      this.logger.log(`Cache cleared: ${size} entries removed`)
    } catch (error) {
      this.logger.error('Failed to clear cache', error)
    }
  }

  /**
   * 特定チャンネルのキャッシュを削除
   */
  evictChannelCache(channelId: string): void {
    try {
      const existed = this.channelCache.delete(channelId)
      if (existed) {
        this.logger.debug(`Channel cache evicted: ${channelId}`)
      }
    } catch (error) {
      this.logger.error(`Failed to evict channel cache: ${channelId}`, error)
    }
  }

  /**
   * キャッシュのメンテナンス実行
   */
  async performMaintenance(): Promise<void> {
    try {
      this.logger.debug('Starting cache maintenance')

      this.cleanupExpiredCache()

      // メモリ使用量が多い場合は追加クリーンアップ
      const stats = this.getCacheStats()
      if (stats.memoryUsageEstimate > 1000) {
        // 1MB以上の場合
        const targetSize = Math.floor(this.channelCache.size * 0.7) // 30%削減

        while (this.channelCache.size > targetSize) {
          this.evictOldestCacheEntry()
        }

        this.logger.debug(`Cache maintenance: reduced to ${this.channelCache.size} entries`)
      }

      this.logger.debug('Cache maintenance completed')
    } catch (error) {
      this.logger.error('Failed to perform cache maintenance', error)
    }
  }
}
