import {
  CacheEntryMeta,
  computeCacheStats,
  extractTimestampFromSnowflake,
  isCacheEntryFresh,
  isSnowflakeParsable,
  selectExpiredChannelIds,
  selectOldestChannelId
} from './channel-cache.pure'

/**
 * channel-cache.pure.ts の純関数群に対する単体テスト。
 * 副作用がないためモック不要。入力 → 出力のみで検証する。
 */
describe('channel-cache.pure', () => {
  const entry = (id: string, lastAccess: number, messageCacheSize = 0): CacheEntryMeta => ({
    id,
    lastAccess,
    messageCacheSize
  })

  describe('extractTimestampFromSnowflake', () => {
    it('既知の snowflake から Discord epoch 起点のミリ秒を算出する', () => {
      // Arrange: (snowflake >> 22) + 1420070400000
      const snowflake = '175928847299117063'

      // Act
      const result = extractTimestampFromSnowflake(snowflake, 999)

      // Assert
      expect(result).toBe(1462015105796)
    })

    it('snowflake = 0 は Discord epoch(1420070400000) を返す', () => {
      // Act & Assert
      expect(extractTimestampFromSnowflake('0', 999)).toBe(1420070400000)
    })

    it('不正な snowflake は fallbackNow を返す（例外を投げない）', () => {
      // Arrange
      const fallback = 1234567890

      // Act
      const result = extractTimestampFromSnowflake('not-a-number', fallback)

      // Assert
      expect(result).toBe(fallback)
    })

    it('空文字は BigInt("") = 0n となり Discord epoch を返す', () => {
      // Act & Assert（BigInt の仕様: 空文字は 0n）
      expect(extractTimestampFromSnowflake('', 999)).toBe(1420070400000)
    })
  })

  describe('isSnowflakeParsable', () => {
    it('数値文字列は true', () => {
      // Act & Assert
      expect(isSnowflakeParsable('175928847299117063')).toBe(true)
      expect(isSnowflakeParsable('0')).toBe(true)
    })

    it('非数値文字列は false', () => {
      // Act & Assert
      expect(isSnowflakeParsable('not-a-number')).toBe(false)
      expect(isSnowflakeParsable('12.5')).toBe(false)
    })
  })

  describe('isCacheEntryFresh', () => {
    it('now - lastAccess < ttl のとき新鮮(true)', () => {
      // Act & Assert
      expect(isCacheEntryFresh(1000, 1500, 1000)).toBe(true)
    })

    it('経過時間が ttl ちょうどのときは新鮮でない(false)（境界: 厳密な <）', () => {
      // Act & Assert
      expect(isCacheEntryFresh(1000, 2000, 1000)).toBe(false)
    })

    it('ttl を超過したとき新鮮でない(false)', () => {
      // Act & Assert
      expect(isCacheEntryFresh(1000, 3000, 1000)).toBe(false)
    })
  })

  describe('selectExpiredChannelIds', () => {
    it('now - lastAccess > ttl のエントリのみ期限切れとして返す', () => {
      // Arrange
      const entries = [
        entry('fresh', 9500), // 経過 500 < ttl
        entry('exact', 9000), // 経過 1000 == ttl（> ではないので残る）
        entry('expired', 8000) // 経過 2000 > ttl
      ]

      // Act
      const result = selectExpiredChannelIds(entries, 10000, 1000)

      // Assert: 厳密な > のみ期限切れ
      expect(result).toEqual(['expired'])
    })

    it('該当なしのとき空配列を返す', () => {
      // Act & Assert
      expect(selectExpiredChannelIds([entry('a', 10000)], 10000, 1000)).toEqual([])
    })

    it('空配列の入力には空配列を返す', () => {
      // Act & Assert
      expect(selectExpiredChannelIds([], 10000, 1000)).toEqual([])
    })
  })

  describe('selectOldestChannelId', () => {
    it('最も lastAccess が古いエントリの id を返す', () => {
      // Arrange
      const entries = [entry('b', 200), entry('a', 100), entry('c', 300)]

      // Act
      const result = selectOldestChannelId(entries)

      // Assert
      expect(result).toBe('a')
    })

    it('同値が並ぶ場合は最初に出現したものを返す（挿入順を維持）', () => {
      // Arrange
      const entries = [entry('first', 100), entry('second', 100)]

      // Act & Assert
      expect(selectOldestChannelId(entries)).toBe('first')
    })

    it('空配列のとき null を返す', () => {
      // Act & Assert
      expect(selectOldestChannelId([])).toBeNull()
    })
  })

  describe('computeCacheStats', () => {
    it('空配列はすべて 0 / null を返す', () => {
      // Act
      const stats = computeCacheStats([])

      // Assert
      expect(stats).toEqual({
        channelCacheSize: 0,
        totalMessagesCached: 0,
        oldestCacheEntry: null,
        newestCacheEntry: null,
        memoryUsageEstimate: 0
      })
    })

    it('集計値と memoryUsageEstimate(=channels*2 + messages*1) を算出する', () => {
      // Arrange: 3 チャンネル、合計 5 メッセージ
      const entries = [entry('a', 100, 2), entry('b', 300, 0), entry('c', 200, 3)]

      // Act
      const stats = computeCacheStats(entries)

      // Assert
      expect(stats.channelCacheSize).toBe(3)
      expect(stats.totalMessagesCached).toBe(5)
      expect(stats.oldestCacheEntry).toBe(100)
      expect(stats.newestCacheEntry).toBe(300)
      expect(stats.memoryUsageEstimate).toBe(3 * 2 + 5 * 1)
    })

    it('単一エントリでは oldest と newest が一致する', () => {
      // Act
      const stats = computeCacheStats([entry('only', 500, 1)])

      // Assert
      expect(stats.oldestCacheEntry).toBe(500)
      expect(stats.newestCacheEntry).toBe(500)
    })
  })
})
