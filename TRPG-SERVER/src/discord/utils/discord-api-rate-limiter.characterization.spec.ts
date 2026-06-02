import { DiscordApiRateLimiter } from './discord-api-rate-limiter'

/**
 * Characterization テスト（特性化テスト）
 *
 * リファクタ前の現挙動を固定し、リファクタ後も同一であることを保証する安全網。
 * Date.now は jest.spyOn で固定、setTimeout は fake timers で即時消化する。
 */
describe('DiscordApiRateLimiter (characterization)', () => {
  let limiter: DiscordApiRateLimiter
  const FIXED_NOW = 1_000_000

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
    limiter = new DiscordApiRateLimiter()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getBucketKey（updateRateLimit/getStats 経由で正規化結果を観察）', () => {
    it('数値IDを :id に置換し METHOD:/normalized/path を生成する', () => {
      limiter.updateRateLimit('/channels/123456/messages', 'get', {
        'x-ratelimit-limit': '5',
        'x-ratelimit-remaining': '4',
        'x-ratelimit-reset': String((FIXED_NOW + 10000) / 1000)
      })

      const stats = limiter.getStats()
      expect(stats.bucketStatus[0].bucket).toBe('GET:/channels/:id/messages')
    })

    it('/api/vN プレフィックスとクエリパラメータを削除する', () => {
      limiter.updateRateLimit('/api/v10/guilds/999/members?limit=100', 'POST', {
        'x-ratelimit-limit': '2',
        'x-ratelimit-remaining': '2',
        'x-ratelimit-reset': String((FIXED_NOW + 5000) / 1000)
      })

      const stats = limiter.getStats()
      expect(stats.bucketStatus[0].bucket).toBe('POST:/guilds/:id/members')
    })
  })

  describe('waitForRateLimit', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('グローバル制限が未来のとき wait し、その後 bucket を減算する', async () => {
      // globalReset を未来に設定（429 グローバル）
      limiter.updateRateLimit('/channels/1/messages', 'GET', {
        'x-ratelimit-global': 'true',
        'retry-after': '2'
      })

      // bucket を別途用意（remaining=3）
      limiter.updateRateLimit('/channels/1/messages', 'GET', {
        'x-ratelimit-limit': '5',
        'x-ratelimit-remaining': '3',
        'x-ratelimit-reset': String((FIXED_NOW + 10000) / 1000)
      })

      const promise = limiter.waitForRateLimit('/channels/1/messages', 'GET')
      await jest.runAllTimersAsync()
      await promise

      const stats = limiter.getStats()
      const bucket = stats.bucketStatus.find((b) => b.bucket === 'GET:/channels/:id/messages')
      // decrementBucket により 3 → 2
      expect(bucket?.remaining).toBe(2)
    })

    it('bucket.remaining<=0 かつ reset>now のとき wait する（remaining は 0 のまま）', async () => {
      limiter.updateRateLimit('/channels/2/messages', 'GET', {
        'x-ratelimit-limit': '5',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String((FIXED_NOW + 8000) / 1000)
      })

      const promise = limiter.waitForRateLimit('/channels/2/messages', 'GET')
      await jest.runAllTimersAsync()
      await promise

      const stats = limiter.getStats()
      const bucket = stats.bucketStatus.find((b) => b.bucket === 'GET:/channels/:id/messages')
      // remaining 0 のままで decrement は効かない
      expect(bucket?.remaining).toBe(0)
    })

    it('制限が無いとき即座に解決し remaining を減算する', async () => {
      limiter.updateRateLimit('/users/5', 'GET', {
        'x-ratelimit-limit': '10',
        'x-ratelimit-remaining': '10',
        'x-ratelimit-reset': String((FIXED_NOW + 10000) / 1000)
      })

      await limiter.waitForRateLimit('/users/5', 'GET')

      const stats = limiter.getStats()
      const bucket = stats.bucketStatus.find((b) => b.bucket === 'GET:/users/:id')
      expect(bucket?.remaining).toBe(9)
    })
  })

  describe('updateRateLimit', () => {
    it('x-ratelimit-global で globalReset が retry-after*1000 分更新される', () => {
      limiter.updateRateLimit('/foo', 'GET', {
        'x-ratelimit-global': 'true',
        'retry-after': '3'
      })

      const stats = limiter.getStats()
      // globalReset = now + 3000, getStats では resetIn = max(0, reset-now) = 3000
      expect(stats.globalReset).toBe(3000)
    })

    it('limit>0 で bucket が設定され reset は resetTimestamp 優先', () => {
      const resetTs = FIXED_NOW + 12000
      limiter.updateRateLimit('/foo', 'GET', {
        'x-ratelimit-limit': '7',
        'x-ratelimit-remaining': '6',
        'x-ratelimit-reset': String(resetTs / 1000)
      })

      const stats = limiter.getStats()
      expect(stats.bucketStatus[0]).toMatchObject({
        bucket: 'GET:/foo',
        remaining: 6,
        limit: 7,
        resetIn: 12000
      })
    })

    it('resetTimestamp が無いとき now + resetAfter になる', () => {
      limiter.updateRateLimit('/bar', 'GET', {
        'x-ratelimit-limit': '3',
        'x-ratelimit-remaining': '3',
        'x-ratelimit-reset-after': '4'
      })

      const stats = limiter.getStats()
      expect(stats.bucketStatus[0].resetIn).toBe(4000)
    })

    it('status 429 で bucket が強制 remaining=0 になる', () => {
      limiter.updateRateLimit('/baz', 'GET', {
        status: '429',
        'retry-after': '5000'
      })

      const stats = limiter.getStats()
      const bucket = stats.bucketStatus.find((b) => b.bucket === 'GET:/baz')
      expect(bucket?.remaining).toBe(0)
      expect(bucket?.limit).toBe(5)
      expect(bucket?.resetIn).toBe(5000)
    })
  })

  describe('executeBatch', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('fulfilled のみ results に積み、rejected は除外する', async () => {
      const requests = [() => Promise.resolve('a'), () => Promise.reject(new Error('fail')), () => Promise.resolve('c')]

      const promise = limiter.executeBatch(requests, 5, 10)
      await jest.runAllTimersAsync()
      const results = await promise

      expect(results).toEqual(['a', 'c'])
    })

    it('maxConcurrent ごとにバッチ分割して全件処理する', async () => {
      const calls: number[] = []
      const requests = Array.from({ length: 5 }, (_, i) => () => {
        calls.push(i)
        return Promise.resolve(i)
      })

      const promise = limiter.executeBatch(requests, 2, 10)
      await jest.runAllTimersAsync()
      const results = await promise

      expect(results.sort()).toEqual([0, 1, 2, 3, 4])
      expect(calls).toHaveLength(5)
    })
  })

  describe('getStats', () => {
    it('初期状態は globalRemaining=50, activeBuckets=0', () => {
      const stats = limiter.getStats()
      expect(stats.globalRemaining).toBe(50)
      expect(stats.activeBuckets).toBe(0)
      expect(stats.bucketStatus).toEqual([])
    })
  })

  describe('cleanup', () => {
    it('reset<now のバケットは limit までリセットし reset=0 にする', () => {
      // reset を過去にするため、まず未来で登録 → Date.now を進める
      limiter.updateRateLimit('/old', 'GET', {
        'x-ratelimit-limit': '5',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String((FIXED_NOW + 1000) / 1000)
      })

      // now を 2000ms 進める（reset を過ぎるが 1時間以内）
      ;(Date.now as jest.Mock).mockReturnValue(FIXED_NOW + 2000)

      limiter.cleanup()

      const stats = limiter.getStats()
      const bucket = stats.bucketStatus.find((b) => b.bucket === 'GET:/old')
      // remaining が limit(5) にリセットされ、まだ削除はされていない
      expect(bucket?.remaining).toBe(5)
    })

    it('reset<now-3600000 のバケットは削除される', () => {
      limiter.updateRateLimit('/expired', 'GET', {
        'x-ratelimit-limit': '5',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String((FIXED_NOW + 1000) / 1000)
      })

      // 1時間 + 余裕を進める
      ;(Date.now as jest.Mock).mockReturnValue(FIXED_NOW + 1000 + 3_600_001)

      limiter.cleanup()

      const stats = limiter.getStats()
      expect(stats.activeBuckets).toBe(0)
    })
  })

  describe('reset', () => {
    it('グローバル・バケットを初期状態に戻す', () => {
      limiter.updateRateLimit('/foo', 'GET', {
        'x-ratelimit-limit': '5',
        'x-ratelimit-remaining': '2',
        'x-ratelimit-reset': String((FIXED_NOW + 1000) / 1000)
      })

      limiter.reset()

      const stats = limiter.getStats()
      expect(stats.globalRemaining).toBe(50)
      expect(stats.globalReset).toBe(0)
      expect(stats.activeBuckets).toBe(0)
    })
  })
})
