import { Test, TestingModule } from '@nestjs/testing'
import { MetricsCollectorService } from './metrics-collector.service'

/**
 * C-3b′（2026-07-07）: @OnEvent 供給 5 本（onDiscordCommandStart 等）は dead 配線撤去に伴い削除。
 * discord/http/database カウンタは公開 API から加算不能となったため、本 spec は
 * 「常にゼロのまま出力形状が維持される」ことを characterization として固定する。
 * EventEmitter2 注入も未使用化により削除済み（モック不要）。
 */
describe('MetricsCollectorService', () => {
  let service: MetricsCollectorService
  let module: TestingModule

  // process.memoryUsage は MB 換算前の bytes を返す。1MB = 1024*1024 = 1048576 bytes
  const MB = 1024 * 1024
  const mockMemoryUsage = {
    rss: 100 * MB,
    heapTotal: 80 * MB,
    heapUsed: 50 * MB,
    external: 10 * MB,
    arrayBuffers: 5 * MB
  } as NodeJS.MemoryUsage

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [MetricsCollectorService]
    }).compile()

    service = moduleRef.get<MetricsCollectorService>(MetricsCollectorService)
    module = moduleRef

    jest.clearAllMocks()
    jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await module.close()
  })

  // C-3b′（2026-07-07）: onDiscordCommandStart / onDiscordCommandComplete / onDiscordEventProcessed /
  // onHttpRequestComplete / onDatabaseQueryComplete の describe 5 本は dead 供給メソッドの撤去に伴い削除。

  describe('getSystemMetrics', () => {
    it('memoryUsage を MB に丸めて返す', () => {
      const memory = service.getSystemMetrics().memory

      expect(memory).toEqual({
        rss: 100,
        heapTotal: 80,
        heapUsed: 50,
        heapUsedMB: 50,
        external: 10
      })
    })

    it('端数は四捨五入される', () => {
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        ...mockMemoryUsage,
        // 1.5MB 相当 → Math.round で 2
        heapUsed: Math.round(1.5 * MB)
      } as NodeJS.MemoryUsage)

      expect(service.getSystemMetrics().memory.heapUsed).toBe(2)
    })

    it('discord/http/database セクションの出力形状を維持する（供給者撤去後は常にゼロ）', () => {
      const metrics = service.getSystemMetrics()

      expect(metrics.discord).toEqual({
        commandsExecuted: 0,
        eventsProcessed: 0,
        embedsCreated: 0,
        messagesSent: 0,
        channelsCreated: 0,
        errors: 0,
        totalResponseTime: 0
      })
      expect(metrics.http).toEqual({ requests: 0, responses: 0, errors: 0, totalResponseTime: 0 })
      expect(metrics.database).toEqual({ queries: 0, errors: 0, totalResponseTime: 0 })
      expect(typeof metrics.startTime).toBe('number')
    })
  })

  describe('getMemoryUsage', () => {
    it('heapUsedMB / rssMB / externalMB を MB に丸めて返す', () => {
      expect(service.getMemoryUsage()).toEqual({
        heapUsedMB: 50,
        rssMB: 100,
        externalMB: 10
      })
    })
  })

  describe('getErrorRate', () => {
    it('操作が無い場合は 0 を返す（ゼロ除算ガード）', () => {
      expect(service.getErrorRate()).toBe(0)
    })

    // C-3b′（2026-07-07）: 比率計算のテスト 2 件は、カウンタ加算手段（dead 供給メソッド）の撤去により
    // 到達不能状態のテストとなったため削除（実行時に到達可能なのはゼロ除算ガードのみ）。
  })

  describe('aggregateHourlyMetrics', () => {
    it('現在時刻キーで hourly トレンドに集計を記録する', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-02T10:30:00.000Z'))

      service.aggregateHourlyMetrics()

      const trends = service.getTrends()
      expect(trends.hourly).toHaveLength(1)
      const [key, data] = trends.hourly[0]
      expect(key).toBe('2026-06-02T10')
      expect(data.discord.commandsExecuted).toBe(0)

      jest.useRealTimers()
    })

    it('24時間より古い hourly データを削除する', () => {
      // 古いエントリを作る
      jest.useFakeTimers().setSystemTime(new Date('2026-06-01T00:00:00.000Z'))
      service.aggregateHourlyMetrics()

      // 25時間後に集計 → 古いエントリは cutoff で削除される
      jest.useFakeTimers().setSystemTime(new Date('2026-06-02T01:00:00.000Z'))
      service.aggregateHourlyMetrics()

      const keys = service.getTrends().hourly.map(([k]) => k)
      expect(keys).toEqual(['2026-06-02T01'])

      jest.useRealTimers()
    })
  })

  describe('aggregateDailyMetrics', () => {
    it('日付キーで daily トレンドに集計を記録する', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-02T10:00:00.000Z'))

      service.aggregateDailyMetrics()

      const [key, data] = service.getTrends().daily[0]
      expect(key).toBe('2026-06-02')
      expect(data.totalCommands).toBe(0)

      jest.useRealTimers()
    })

    it('操作が無い場合の平均応答時間は 0（ゼロ除算ガード）', () => {
      service.aggregateDailyMetrics()

      const [, data] = service.getTrends().daily[0]
      expect(data.avgDiscordResponseTime).toBe(0)
      expect(data.avgHttpResponseTime).toBe(0)
      expect(data.avgDbResponseTime).toBe(0)
    })

    it('30日より古い daily データを削除する', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-01T00:00:00.000Z'))
      service.aggregateDailyMetrics()

      jest.useFakeTimers().setSystemTime(new Date('2026-06-02T00:00:00.000Z'))
      service.aggregateDailyMetrics()

      const keys = service.getTrends().daily.map(([k]) => k)
      expect(keys).toEqual(['2026-06-02'])

      jest.useRealTimers()
    })
  })

  describe('getTrends', () => {
    it('初期状態では空の配列を返す', () => {
      expect(service.getTrends()).toEqual({ hourly: [], daily: [] })
    })
  })

  describe('resetAllMetrics', () => {
    it('全メトリクスとトレンドをリセットする', () => {
      service.aggregateHourlyMetrics()
      expect(service.getTrends().hourly).toHaveLength(1)

      service.resetAllMetrics()

      const metrics = service.getSystemMetrics()
      expect(metrics.discord.commandsExecuted).toBe(0)
      expect(metrics.http.requests).toBe(0)
      expect(service.getTrends()).toEqual({ hourly: [], daily: [] })
    })
  })
})
