import { Injectable, Logger } from '@nestjs/common'
import {
  BucketLimit,
  computeResetTimestamp,
  computeStats,
  computeWaitTime,
  evaluateCleanup,
  getBucketKey,
  RateLimiterStats,
  shouldWait,
  shouldWaitForBucket
} from './rate-limiter.pure'

/**
 * Discord API レート制限管理
 * グローバル・バケット別のレート制限に対応
 *
 * 計算ロジックは rate-limiter.pure.ts の純関数へ委譲し、
 * 副作用境界（時刻取得 now / 待機 wait）だけを protected seam として持つ。
 */
@Injectable()
export class DiscordApiRateLimiter {
  private readonly logger = new Logger(DiscordApiRateLimiter.name)

  // グローバルレート制限情報
  private globalReset = 0
  private globalRemaining = 50

  // バケット別レート制限（ルート別）
  private readonly bucketLimits = new Map<string, BucketLimit>()

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
   * 現在時刻取得（seam）。テストで上書き可能。
   */
  protected now(): number {
    return Date.now()
  }

  /**
   * 指定時間待機（seam）。テストで fake timers / 上書き可能。
   */
  protected wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * API リクエスト前の制限チェックと待機
   */
  async waitForRateLimit(route: string, method: string = 'GET'): Promise<void> {
    const bucketKey = getBucketKey(route, method)

    // グローバル制限チェック
    const now = this.now()
    if (shouldWait(this.globalReset, now)) {
      const waitTime = computeWaitTime(this.globalReset, now)
      this.logger.warn(`Global rate limit hit, waiting ${waitTime}ms`)
      await this.wait(waitTime)
    }

    // バケット制限チェック
    const bucket = this.bucketLimits.get(bucketKey)
    if (shouldWaitForBucket(bucket, now)) {
      const waitTime = computeWaitTime(bucket!.reset, now)
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
    const bucketKey = getBucketKey(route, method)

    // グローバル制限更新
    if (headers['x-ratelimit-global']) {
      const retryAfter = parseInt(headers['retry-after'] || '0') * 1000
      this.globalReset = this.now() + retryAfter
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
        reset: computeResetTimestamp(resetTimestamp, this.now(), resetAfter),
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
        reset: this.now() + retryAfter
      })
    }
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
  getStats(): RateLimiterStats {
    return computeStats(this.bucketLimits, this.globalRemaining, this.globalReset, this.now())
  }

  /**
   * キャッシュクリーンアップ（期限切れバケット削除）
   */
  cleanup(): void {
    const now = this.now()
    const expiredBuckets: string[] = []

    for (const [bucket, info] of this.bucketLimits.entries()) {
      // reset<now のバケットは制限をリセット（reset=0 へ書き換え）
      if (evaluateCleanup(info.reset, now).shouldReset) {
        info.remaining = info.limit
        info.reset = 0
      }

      // 長時間使用されていないバケットを削除
      // 元挙動を保つため、reset 書き換え後の値で再判定する
      if (evaluateCleanup(info.reset, now).shouldDelete) {
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
