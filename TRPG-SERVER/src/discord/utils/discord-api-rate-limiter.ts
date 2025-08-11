import { Injectable, Logger } from '@nestjs/common'

/**
 * Discord API レート制限管理
 * グローバル・バケット別のレート制限に対応
 */
@Injectable()
export class DiscordApiRateLimiter {
  private readonly logger = new Logger(DiscordApiRateLimiter.name)

  // グローバルレート制限情報
  private globalReset = 0
  private globalRemaining = 50

  // バケット別レート制限（ルート別）
  private readonly bucketLimits = new Map<
    string,
    {
      limit: number
      remaining: number
      reset: number
      resetAfter?: number
    }
  >()

  // リクエスト待機キュー
  private readonly requestQueue = new Map<
    string,
    Array<{
      resolve: () => void
      reject: (error: Error) => void
      timestamp: number
    }>
  >()

  /**
   * API リクエスト前の制限チェックと待機
   */
  async waitForRateLimit(route: string, method: string = 'GET'): Promise<void> {
    const bucketKey = this.getBucketKey(route, method)

    // グローバル制限チェック
    const now = Date.now()
    if (this.globalReset > now) {
      const waitTime = this.globalReset - now
      this.logger.warn(`Global rate limit hit, waiting ${waitTime}ms`)
      await this.wait(waitTime)
    }

    // バケット制限チェック
    const bucket = this.bucketLimits.get(bucketKey)
    if (bucket && bucket.remaining <= 0 && bucket.reset > now) {
      const waitTime = bucket.reset - now
      this.logger.warn(`Bucket rate limit hit for ${bucketKey}, waiting ${waitTime}ms`)
      await this.wait(waitTime)
    }

    // リクエストカウント減少
    this.decrementBucket(bucketKey)
  }

  /**
   * API レスポンス後のレート制限情報更新
   */
  updateRateLimit(route: string, method: string, headers: Record<string, string>): void {
    const bucketKey = this.getBucketKey(route, method)

    // グローバル制限更新
    if (headers['x-ratelimit-global']) {
      const retryAfter = parseInt(headers['retry-after'] || '0') * 1000
      this.globalReset = Date.now() + retryAfter
      this.logger.warn(`Global rate limit updated: ${retryAfter}ms`)
    }

    // バケット制限更新
    const limit = parseInt(headers['x-ratelimit-limit'] || '0')
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '0')
    const resetTimestamp = parseFloat(headers['x-ratelimit-reset'] || '0') * 1000
    const resetAfter = parseInt(headers['x-ratelimit-reset-after'] || '0') * 1000

    if (limit > 0) {
      this.bucketLimits.set(bucketKey, {
        limit,
        remaining,
        reset: resetTimestamp || Date.now() + resetAfter,
        resetAfter
      })

      this.logger.debug(`Rate limit updated for ${bucketKey}: ${remaining}/${limit} remaining`)
    }

    // 429 レスポンス（Rate Limited）の場合
    if (headers['status'] === '429') {
      const retryAfter = parseInt(headers['retry-after'] || '1000')
      this.logger.error(`Rate limited on ${bucketKey}, retry after ${retryAfter}ms`)

      // バケット制限を強制更新
      this.bucketLimits.set(bucketKey, {
        limit: limit || 5,
        remaining: 0,
        reset: Date.now() + retryAfter
      })
    }
  }

  /**
   * バケットキー生成（ルートとメソッドから）
   */
  private getBucketKey(route: string, method: string): string {
    // Discord API のバケット生成ロジック
    // 例: /channels/:id/messages -> channels/:id/messages
    const normalizedRoute = route
      .replace(/\/\d+/g, '/:id') // 数値IDをプレースホルダーに
      .replace(/^\/api\/v\d+/, '') // APIバージョンプレフィックス削除
      .replace(/\?.*$/, '') // クエリパラメータ削除

    return `${method.toUpperCase()}:${normalizedRoute}`
  }

  /**
   * バケットのリクエストカウント減少
   */
  private decrementBucket(bucketKey: string): void {
    const bucket = this.bucketLimits.get(bucketKey)
    if (bucket && bucket.remaining > 0) {
      bucket.remaining--
    }
  }

  /**
   * 指定時間待機
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * バースト保護付きの並列リクエスト制限
   */
  async executeBatch<T>(
    requests: Array<() => Promise<T>>,
    maxConcurrent: number = 5,
    delayBetweenRequests: number = 100
  ): Promise<T[]> {
    const results: T[] = []
    const errors: Error[] = []

    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent)

      const batchPromises = batch.map(async (request, index) => {
        try {
          // バースト保護のため少しずつずらして実行
          if (index > 0) {
            await this.wait(delayBetweenRequests * index)
          }

          return await request()
        } catch (error) {
          errors.push(error as Error)
          throw error
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        }
      }

      // バッチ間の待機
      if (i + maxConcurrent < requests.length) {
        await this.wait(delayBetweenRequests * 2)
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`Batch execution completed with ${errors.length} errors out of ${requests.length} requests`)
    }

    return results
  }

  /**
   * 統計情報取得
   */
  getStats(): {
    globalRemaining: number
    globalReset: number
    activeBuckets: number
    bucketStatus: Array<{
      bucket: string
      remaining: number
      limit: number
      resetIn: number
    }>
  } {
    const now = Date.now()
    const bucketStatus = Array.from(this.bucketLimits.entries()).map(([bucket, info]) => ({
      bucket,
      remaining: info.remaining,
      limit: info.limit,
      resetIn: Math.max(0, info.reset - now)
    }))

    return {
      globalRemaining: this.globalRemaining,
      globalReset: Math.max(0, this.globalReset - now),
      activeBuckets: this.bucketLimits.size,
      bucketStatus
    }
  }

  /**
   * キャッシュクリーンアップ（期限切れバケット削除）
   */
  cleanup(): void {
    const now = Date.now()
    const expiredBuckets = []

    for (const [bucket, info] of this.bucketLimits.entries()) {
      if (info.reset < now) {
        // リセット時刻を過ぎたバケットは制限をリセット
        info.remaining = info.limit
        info.reset = 0
      }

      // 長時間使用されていないバケットを削除
      if (info.reset < now - 3600000) {
        // 1時間
        expiredBuckets.push(bucket)
      }
    }

    expiredBuckets.forEach((bucket) => this.bucketLimits.delete(bucket))

    if (expiredBuckets.length > 0) {
      this.logger.debug(`Cleaned up ${expiredBuckets.length} expired rate limit buckets`)
    }
  }

  /**
   * 緊急時のレート制限リセット
   */
  reset(): void {
    this.globalReset = 0
    this.globalRemaining = 50
    this.bucketLimits.clear()
    this.requestQueue.clear()
    this.logger.warn('Rate limiter has been reset')
  }
}
