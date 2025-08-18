import { Injectable, Logger } from '@nestjs/common'
import { Client, TextChannel, NewsChannel, ThreadChannel, Message } from 'discord.js'
import { ErrorHandler } from '../../utils/error-handler'
import { AppConfigService } from '../../config/config.service'

/**
 * チャンネルキャッシュ管理サービス
 *
 * 責務：
 * - チャンネル情報のキャッシュ管理
 * - メッセージキャッシュの最適化
 * - パフォーマンス向上とメモリ効率化
 */
@Injectable()
export class ChannelCacheService {
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

  constructor(private readonly appConfigService: AppConfigService) {
    // 環境変数またはデフォルト値を使用
    this.CACHE_TTL = Number(process.env.DISCORD_CACHE_TTL) || 300000 // 5分
    this.MESSAGE_CACHE_LIMIT = Number(process.env.DISCORD_MESSAGE_CACHE_LIMIT) || 30 // メモリ効率化
    this.MAX_CHANNEL_CACHE = Number(process.env.DISCORD_CHANNEL_CACHE_LIMIT) || 50 // メモリ効率化
    this.logger.debug(
      `Channel cache service initialized with limits: ${this.MAX_CHANNEL_CACHE} channels, ${this.MESSAGE_CACHE_LIMIT} messages/channel`
    )

    // 定期的なキャッシュクリーンアップ（頻度を最適化）
    setInterval(
      () => {
        this.cleanupExpiredCache()
      },
      Math.min(this.CACHE_TTL / 2, 60000)
    ) // 最大1分間隔でクリーンアップ
  }

  /**
   * チャンネルを取得（キャッシュ優先）
   */
  async getChannel(client: Client, channelId: string): Promise<TextChannel | NewsChannel | ThreadChannel | null> {
    try {
      // キャッシュから取得を試行
      const cached = this.channelCache.get(channelId)
      if (cached && Date.now() - cached.lastAccess < this.CACHE_TTL) {
        cached.lastAccess = Date.now()
        this.logger.debug(`Channel retrieved from cache: ${channelId}`)
        return cached.channel
      }

      // キャッシュにない場合はDiscord APIから取得
      const channel = await client.channels.fetch(channelId)

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
   * チャンネルキャッシュを更新
   */
  private updateChannelCache(channel: TextChannel | NewsChannel | ThreadChannel): void {
    try {
      // キャッシュサイズ制限チェック
      if (this.channelCache.size >= this.MAX_CHANNEL_CACHE) {
        this.evictOldestCacheEntry()
      }

      this.channelCache.set(channel.id, {
        channel,
        lastAccess: Date.now(),
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
   */
  private cleanupExpiredCache(): void {
    try {
      const now = Date.now()
      const expiredChannels: string[] = []

      for (const [channelId, cached] of this.channelCache.entries()) {
        if (now - cached.lastAccess > this.CACHE_TTL) {
          expiredChannels.push(channelId)
        }
      }

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
   */
  private evictOldestCacheEntry(): void {
    try {
      let oldestChannelId: string | null = null
      let oldestTime = Date.now()

      for (const [channelId, cached] of this.channelCache.entries()) {
        if (cached.lastAccess < oldestTime) {
          oldestTime = cached.lastAccess
          oldestChannelId = channelId
        }
      }

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
   */
  extractTimestampFromSnowflake(snowflake: string): number {
    try {
      const timestamp = (BigInt(snowflake) >> 22n) + 1420070400000n
      return Number(timestamp)
    } catch (error) {
      this.logger.error(`Failed to extract timestamp from snowflake: ${snowflake}`, error)
      return Date.now()
    }
  }

  /**
   * キャッシュ統計情報を取得
   */
  getCacheStats(): {
    channelCacheSize: number
    totalMessagesCached: number
    oldestCacheEntry: number | null
    newestCacheEntry: number | null
    memoryUsageEstimate: number
  } {
    try {
      let totalMessages = 0
      let oldestEntry: number | null = null
      let newestEntry: number | null = null

      for (const cached of this.channelCache.values()) {
        totalMessages += cached.messageCache.size

        if (oldestEntry === null || cached.lastAccess < oldestEntry) {
          oldestEntry = cached.lastAccess
        }

        if (newestEntry === null || cached.lastAccess > newestEntry) {
          newestEntry = cached.lastAccess
        }
      }

      // メモリ使用量の概算（KB単位）
      const memoryEstimate = this.channelCache.size * 2 + totalMessages * 1 // 簡易計算

      return {
        channelCacheSize: this.channelCache.size,
        totalMessagesCached: totalMessages,
        oldestCacheEntry: oldestEntry,
        newestCacheEntry: newestEntry,
        memoryUsageEstimate: memoryEstimate
      }
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
