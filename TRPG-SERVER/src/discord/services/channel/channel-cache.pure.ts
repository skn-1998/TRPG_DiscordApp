/**
 * ChannelCacheService の純粋関数群（Pure functions）
 *
 * 設計方針:
 * - 副作用を持たない（Date.now / Map 変更 / ログ / I/O に触れない）。
 * - discord.js 型に依存しない。キャッシュ判断に必要な最小限の値だけを引数に受け取る。
 *   → これにより `shared/` の制約（discord.js を import しない）にも抵触せず、
 *     同ディレクトリ配下の純モジュールとして再利用・単体テストできる。
 * - 時刻は引数 `now` として受け取り、関数内では取得しない（決定的）。
 *
 * 純関数の責務はキャッシュの「判断ロジック」のみ。Map の実体操作（delete/set）は
 * 呼び出し側（imperative shell = ChannelCacheService）が担う。
 */

/** キャッシュ判断に必要な最小メタ情報（discord.js 非依存） */
export interface CacheEntryMeta {
  id: string
  lastAccess: number
  messageCacheSize: number
}

/** getCacheStats の戻り値型 */
export interface CacheStats {
  channelCacheSize: number
  totalMessagesCached: number
  oldestCacheEntry: number | null
  newestCacheEntry: number | null
  memoryUsageEstimate: number
}

/**
 * Snowflake から Discord epoch 起点のタイムスタンプ(ms)を算出する純関数。
 *
 * 不正入力時は例外を投げず `fallbackNow` を返す（呼び出し側が Date.now() を渡す）。
 * これにより時刻依存を関数外へ追い出しつつ、現挙動（失敗時 now フォールバック）を維持する。
 */
export function extractTimestampFromSnowflake(snowflake: string, fallbackNow: number): number {
  try {
    const timestamp = (BigInt(snowflake) >> 22n) + 1420070400000n
    return Number(timestamp)
  } catch {
    return fallbackNow
  }
}

/**
 * snowflake が BigInt として解釈可能かを判定する純関数。
 * `extractTimestampFromSnowflake` の戻り値が偶然 fallbackNow と一致したケースと、
 * 実際にパース失敗したケースを区別する（ログ出力要否の判断に使う）。
 */
export function isSnowflakeParsable(snowflake: string): boolean {
  try {
    BigInt(snowflake)
    return true
  } catch {
    return false
  }
}

/**
 * TTL 内でキャッシュが新鮮か（= fetch せずに使えるか）を判定する純関数。
 * 現挙動: `now - lastAccess < ttl` のとき新鮮。
 */
export function isCacheEntryFresh(lastAccess: number, now: number, ttl: number): boolean {
  return now - lastAccess < ttl
}

/**
 * 期限切れ（TTL 超過）のチャンネル ID 一覧を返す純関数。
 * 現挙動: `now - lastAccess > ttl` のとき期限切れ。
 */
export function selectExpiredChannelIds(entries: readonly CacheEntryMeta[], now: number, ttl: number): string[] {
  const expired: string[] = []
  for (const entry of entries) {
    if (now - entry.lastAccess > ttl) {
      expired.push(entry.id)
    }
  }
  return expired
}

/**
 * LRU eviction 対象（最も lastAccess が古いエントリ）の ID を返す純関数。
 * 該当なし（空）の場合は null。
 *
 * 現挙動の再現: 旧実装は `oldestTime = Date.now()` を初期値とし
 * `lastAccess < oldestTime` を厳密比較していた。空配列なら null、
 * 同値が並ぶ場合は最初に出現したものが選ばれる（Map の挿入順）。
 */
export function selectOldestChannelId(entries: readonly CacheEntryMeta[]): string | null {
  let oldestId: string | null = null
  let oldestTime = Number.POSITIVE_INFINITY
  for (const entry of entries) {
    if (entry.lastAccess < oldestTime) {
      oldestTime = entry.lastAccess
      oldestId = entry.id
    }
  }
  return oldestId
}

/**
 * キャッシュ統計を集計する純関数。
 * memoryUsageEstimate の式は現挙動を踏襲: channels * 2 + totalMessages * 1。
 */
export function computeCacheStats(entries: readonly CacheEntryMeta[]): CacheStats {
  let totalMessages = 0
  let oldestEntry: number | null = null
  let newestEntry: number | null = null

  for (const entry of entries) {
    totalMessages += entry.messageCacheSize

    if (oldestEntry === null || entry.lastAccess < oldestEntry) {
      oldestEntry = entry.lastAccess
    }
    if (newestEntry === null || entry.lastAccess > newestEntry) {
      newestEntry = entry.lastAccess
    }
  }

  const channelCacheSize = entries.length
  const memoryUsageEstimate = channelCacheSize * 2 + totalMessages * 1

  return {
    channelCacheSize,
    totalMessagesCached: totalMessages,
    oldestCacheEntry: oldestEntry,
    newestCacheEntry: newestEntry,
    memoryUsageEstimate
  }
}
