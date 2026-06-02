/**
 * Discord API レート制限の純関数群（discord.js 非依存・DI なし）
 *
 * 副作用（Date.now / setTimeout / 状態 Map）を持たず、引数と戻り値だけで完結する。
 * DiscordApiRateLimiter から計算ロジックのみを抽出したもの。
 */

/** バケット情報 */
export interface BucketLimit {
  limit: number
  remaining: number
  reset: number
  resetAfter?: number
}

/** getStats のバケット状態 */
export interface BucketStatusEntry {
  bucket: string
  remaining: number
  limit: number
  resetIn: number
}

/** getStats の戻り形 */
export interface RateLimiterStats {
  globalRemaining: number
  globalReset: number
  activeBuckets: number
  bucketStatus: BucketStatusEntry[]
}

/** cleanup の各バケットに対する判定結果 */
export interface CleanupDecision {
  /** reset<now：制限をリセットすべきか */
  shouldReset: boolean
  /** reset<now-3600000：削除対象か */
  shouldDelete: boolean
}

/**
 * バケットキー生成（ルートとメソッドから）
 *
 * 例: /channels/123/messages -> GET:/channels/:id/messages
 * - 数値IDを :id に置換
 * - /api/vN プレフィックス削除
 * - クエリパラメータ削除
 */
export function getBucketKey(route: string, method: string): string {
  const normalizedRoute = route
    .replace(/\/\d+/g, '/:id') // 数値IDをプレースホルダーに
    .replace(/^\/api\/v\d+/, '') // APIバージョンプレフィックス削除
    .replace(/\?.*$/, '') // クエリパラメータ削除

  return `${method.toUpperCase()}:${normalizedRoute}`
}

/**
 * reset 時刻が now より未来かどうか（待機が必要か）。
 * グローバル制限・バケット制限の双方で使う。
 */
export function shouldWait(reset: number, now: number): boolean {
  return reset > now
}

/**
 * 待機時間（ms）。reset と now の差。
 */
export function computeWaitTime(reset: number, now: number): number {
  return reset - now
}

/**
 * バケット制限により待機が必要か（remaining<=0 かつ reset>now）。
 */
export function shouldWaitForBucket(bucket: BucketLimit | undefined, now: number): boolean {
  return !!bucket && bucket.remaining <= 0 && shouldWait(bucket.reset, now)
}

/**
 * x-ratelimit-reset（秒）優先、無ければ now + resetAfter で reset タイムスタンプを算出。
 */
export function computeResetTimestamp(resetTimestamp: number, now: number, resetAfter: number): number {
  return resetTimestamp || now + resetAfter
}

/**
 * 統計情報を組み立てる。resetIn = max(0, reset - now)。
 */
export function computeStats(
  buckets: ReadonlyMap<string, BucketLimit>,
  globalRemaining: number,
  globalReset: number,
  now: number
): RateLimiterStats {
  const bucketStatus: BucketStatusEntry[] = Array.from(buckets.entries()).map(([bucket, info]) => ({
    bucket,
    remaining: info.remaining,
    limit: info.limit,
    resetIn: Math.max(0, info.reset - now)
  }))

  return {
    globalRemaining,
    globalReset: Math.max(0, globalReset - now),
    activeBuckets: buckets.size,
    bucketStatus
  }
}

/**
 * cleanup における各バケットの期限判定。
 * - reset<now: 制限リセット対象
 * - reset<now-3600000（1時間）: 削除対象
 */
export function evaluateCleanup(reset: number, now: number): CleanupDecision {
  return {
    shouldReset: reset < now,
    shouldDelete: reset < now - 3600000
  }
}
