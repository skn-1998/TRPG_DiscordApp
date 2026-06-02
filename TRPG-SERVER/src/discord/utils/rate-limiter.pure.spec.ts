import {
  BucketLimit,
  computeResetTimestamp,
  computeStats,
  computeWaitTime,
  evaluateCleanup,
  getBucketKey,
  shouldWait,
  shouldWaitForBucket
} from './rate-limiter.pure'

/**
 * rate-limiter.pure.ts の純関数テスト。
 *
 * 副作用（Date.now / setTimeout / 状態 Map）を持たないため、
 * モック不要で入出力のみを検証する。
 */
describe('rate-limiter.pure', () => {
  describe('getBucketKey', () => {
    it('数値IDを :id に置換し METHOD:/normalized/path を生成する', () => {
      const result = getBucketKey('/channels/123456/messages', 'get')
      expect(result).toBe('GET:/channels/:id/messages')
    })

    it('連続する数値IDをすべて :id に置換する', () => {
      const result = getBucketKey('/guilds/111/channels/222', 'GET')
      expect(result).toBe('GET:/guilds/:id/channels/:id')
    })

    it('/api/vN プレフィックスを削除する', () => {
      const result = getBucketKey('/api/v10/users/5', 'GET')
      expect(result).toBe('GET:/users/:id')
    })

    it('クエリパラメータを削除する', () => {
      const result = getBucketKey('/guilds/999/members?limit=100', 'POST')
      expect(result).toBe('POST:/guilds/:id/members')
    })

    it('method を大文字化する', () => {
      const result = getBucketKey('/foo', 'patch')
      expect(result).toBe('PATCH:/foo')
    })

    it('数値・プレフィックス・クエリすべてを同時に正規化する', () => {
      const result = getBucketKey('/api/v9/channels/42/messages?around=100', 'delete')
      expect(result).toBe('DELETE:/channels/:id/messages')
    })
  })

  describe('shouldWait', () => {
    it('reset が now より未来なら true', () => {
      expect(shouldWait(2000, 1000)).toBe(true)
    })

    it('reset が now と同じなら false', () => {
      expect(shouldWait(1000, 1000)).toBe(false)
    })

    it('reset が now より過去なら false', () => {
      expect(shouldWait(500, 1000)).toBe(false)
    })
  })

  describe('computeWaitTime', () => {
    it('reset と now の差を返す', () => {
      expect(computeWaitTime(3000, 1000)).toBe(2000)
    })

    it('reset が now と同じなら 0 を返す', () => {
      expect(computeWaitTime(1000, 1000)).toBe(0)
    })
  })

  describe('shouldWaitForBucket', () => {
    it('bucket が undefined なら false', () => {
      expect(shouldWaitForBucket(undefined, 1000)).toBe(false)
    })

    it('remaining<=0 かつ reset>now なら true', () => {
      const bucket: BucketLimit = { limit: 5, remaining: 0, reset: 2000 }
      expect(shouldWaitForBucket(bucket, 1000)).toBe(true)
    })

    it('remaining>0 なら（reset が未来でも）false', () => {
      const bucket: BucketLimit = { limit: 5, remaining: 1, reset: 2000 }
      expect(shouldWaitForBucket(bucket, 1000)).toBe(false)
    })

    it('remaining<=0 でも reset<=now なら false', () => {
      const bucket: BucketLimit = { limit: 5, remaining: 0, reset: 500 }
      expect(shouldWaitForBucket(bucket, 1000)).toBe(false)
    })
  })

  describe('computeResetTimestamp', () => {
    it('resetTimestamp が真値ならそれを優先する', () => {
      expect(computeResetTimestamp(5000, 1000, 9999)).toBe(5000)
    })

    it('resetTimestamp が 0 のとき now + resetAfter になる', () => {
      expect(computeResetTimestamp(0, 1000, 4000)).toBe(5000)
    })
  })

  describe('computeStats', () => {
    it('初期状態（空Map）は activeBuckets=0, bucketStatus=[]', () => {
      const stats = computeStats(new Map<string, BucketLimit>(), 50, 0, 1000)
      expect(stats).toEqual({
        globalRemaining: 50,
        globalReset: 0,
        activeBuckets: 0,
        bucketStatus: []
      })
    })

    it('globalReset は max(0, reset - now) で算出する', () => {
      const stats = computeStats(new Map<string, BucketLimit>(), 10, 4000, 1000)
      expect(stats.globalReset).toBe(3000)
    })

    it('globalReset が過去なら 0 にクランプする', () => {
      const stats = computeStats(new Map<string, BucketLimit>(), 10, 500, 1000)
      expect(stats.globalReset).toBe(0)
    })

    it('各バケットの resetIn は max(0, reset - now) で算出する', () => {
      const buckets = new Map<string, BucketLimit>([
        ['GET:/foo', { limit: 7, remaining: 6, reset: 4000 }],
        ['POST:/bar', { limit: 3, remaining: 0, reset: 500 }]
      ])

      const stats = computeStats(buckets, 50, 0, 1000)

      expect(stats.activeBuckets).toBe(2)
      expect(stats.bucketStatus).toEqual([
        { bucket: 'GET:/foo', remaining: 6, limit: 7, resetIn: 3000 },
        { bucket: 'POST:/bar', remaining: 0, limit: 3, resetIn: 0 }
      ])
    })
  })

  describe('evaluateCleanup', () => {
    it('reset<now なら shouldReset=true', () => {
      const decision = evaluateCleanup(500, 1000)
      expect(decision.shouldReset).toBe(true)
    })

    it('reset>=now なら shouldReset=false', () => {
      const decision = evaluateCleanup(1000, 1000)
      expect(decision.shouldReset).toBe(false)
    })

    it('reset<now-3600000 なら shouldDelete=true', () => {
      const now = 10_000_000
      const decision = evaluateCleanup(now - 3_600_001, now)
      expect(decision.shouldDelete).toBe(true)
    })

    it('reset が now-3600000 ちょうどなら shouldDelete=false（境界）', () => {
      const now = 10_000_000
      const decision = evaluateCleanup(now - 3_600_000, now)
      expect(decision.shouldDelete).toBe(false)
    })

    it('reset=0 でも now が小さいと shouldDelete=false（1時間境界の確認）', () => {
      const decision = evaluateCleanup(0, 1_000_000)
      // 0 < 1_000_000 - 3_600_000 = -2_600_000 は false
      expect(decision.shouldDelete).toBe(false)
    })

    it('reset=0 かつ now が大きいと shouldDelete=true', () => {
      const decision = evaluateCleanup(0, 4_000_000)
      // 0 < 4_000_000 - 3_600_000 = 400_000 は true
      expect(decision.shouldDelete).toBe(true)
    })
  })
})
