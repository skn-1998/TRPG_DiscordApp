import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { MetricsCollectorService } from './metrics-collector.service'

describe('MetricsCollectorService', () => {
  let service: MetricsCollectorService
  let module: TestingModule

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }

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
      providers: [
        MetricsCollectorService,
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter
        }
      ]
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

  describe('onDiscordCommandStart', () => {
    it('commandsExecuted をインクリメントする', () => {
      service.onDiscordCommandStart({ commandName: 'roll', userId: 'user-1' })

      expect(service.getSystemMetrics().discord.commandsExecuted).toBe(1)
    })

    it('複数回呼ぶと累積する', () => {
      service.onDiscordCommandStart({ commandName: 'roll', userId: 'user-1' })
      service.onDiscordCommandStart({ commandName: 'roll', userId: 'user-2', guildId: 'g-1' })

      expect(service.getSystemMetrics().discord.commandsExecuted).toBe(2)
    })
  })

  describe('onDiscordCommandComplete', () => {
    it('成功時は totalResponseTime に加算しエラーは増えない', () => {
      service.onDiscordCommandComplete({ commandName: 'roll', success: true, duration: 120 })

      const discord = service.getSystemMetrics().discord
      expect(discord.totalResponseTime).toBe(120)
      expect(discord.errors).toBe(0)
    })

    it('失敗時は errors をインクリメントしつつ totalResponseTime にも加算する', () => {
      service.onDiscordCommandComplete({
        commandName: 'roll',
        success: false,
        duration: 50,
        error: 'boom'
      })

      const discord = service.getSystemMetrics().discord
      expect(discord.totalResponseTime).toBe(50)
      expect(discord.errors).toBe(1)
    })
  })

  describe('onDiscordEventProcessed', () => {
    it('成功時は eventsProcessed と totalResponseTime を更新しエラーは増えない', () => {
      service.onDiscordEventProcessed({ eventType: 'ready', success: true, duration: 30 })

      const discord = service.getSystemMetrics().discord
      expect(discord.eventsProcessed).toBe(1)
      expect(discord.totalResponseTime).toBe(30)
      expect(discord.errors).toBe(0)
    })

    it('失敗時は errors もインクリメントする', () => {
      service.onDiscordEventProcessed({ eventType: 'ready', success: false, duration: 30 })

      const discord = service.getSystemMetrics().discord
      expect(discord.eventsProcessed).toBe(1)
      expect(discord.errors).toBe(1)
    })
  })

  describe('onHttpRequestComplete', () => {
    it('成功かつ正常ステータスではエラーを増やさない', () => {
      service.onHttpRequestComplete({
        method: 'GET',
        url: '/x',
        statusCode: 200,
        duration: 10,
        success: true
      })

      const http = service.getSystemMetrics().http
      expect(http.requests).toBe(1)
      expect(http.totalResponseTime).toBe(10)
      expect(http.errors).toBe(0)
    })

    it('success が false の場合はエラーをインクリメントする', () => {
      service.onHttpRequestComplete({
        method: 'GET',
        url: '/x',
        statusCode: 200,
        duration: 10,
        success: false
      })

      expect(service.getSystemMetrics().http.errors).toBe(1)
    })

    it('success が true でも statusCode が 400 以上ならエラーをインクリメントする', () => {
      service.onHttpRequestComplete({
        method: 'GET',
        url: '/x',
        statusCode: 404,
        duration: 10,
        success: true
      })

      expect(service.getSystemMetrics().http.errors).toBe(1)
    })
  })

  describe('onDatabaseQueryComplete', () => {
    it('成功時は queries と totalResponseTime を更新しエラーは増えない', () => {
      service.onDatabaseQueryComplete({ operation: 'find', duration: 5, success: true })

      const database = service.getSystemMetrics().database
      expect(database.queries).toBe(1)
      expect(database.totalResponseTime).toBe(5)
      expect(database.errors).toBe(0)
    })

    it('失敗時は errors もインクリメントする', () => {
      service.onDatabaseQueryComplete({
        operation: 'find',
        duration: 5,
        success: false,
        error: 'timeout'
      })

      expect(service.getSystemMetrics().database.errors).toBe(1)
    })
  })

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

    it('集計済みの discord メトリクスを含むスナップショットを返す', () => {
      service.onDiscordCommandStart({ commandName: 'roll', userId: 'u' })

      const metrics = service.getSystemMetrics()
      expect(metrics.discord.commandsExecuted).toBe(1)
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

    it('総操作数に対するエラー数の割合を返す', () => {
      // commands 1 + http 1 = 2 operations, errors: command失敗1 + http失敗1 = 2 → 1.0
      service.onDiscordCommandStart({ commandName: 'roll', userId: 'u' })
      service.onDiscordCommandComplete({ commandName: 'roll', success: false, duration: 1 })
      service.onHttpRequestComplete({
        method: 'GET',
        url: '/x',
        statusCode: 500,
        duration: 1,
        success: false
      })

      // operations = commandsExecuted(1) + http.requests(1) + db.queries(0) = 2
      // errors = discord(1) + http(1) + db(0) = 2
      expect(service.getErrorRate()).toBe(1)
    })

    it('一部のみエラーの場合は比率を返す', () => {
      service.onDiscordCommandStart({ commandName: 'a', userId: 'u' })
      service.onDiscordCommandStart({ commandName: 'b', userId: 'u' })
      service.onDiscordCommandComplete({ commandName: 'a', success: false, duration: 1 })

      // operations = 2, errors = 1 → 0.5
      expect(service.getErrorRate()).toBe(0.5)
    })
  })

  describe('aggregateHourlyMetrics', () => {
    it('現在時刻キーで hourly トレンドに集計を記録する', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-02T10:30:00.000Z'))

      service.onDiscordCommandStart({ commandName: 'roll', userId: 'u' })
      service.aggregateHourlyMetrics()

      const trends = service.getTrends()
      expect(trends.hourly).toHaveLength(1)
      const [key, data] = trends.hourly[0]
      expect(key).toBe('2026-06-02T10')
      expect(data.discord.commandsExecuted).toBe(1)

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
    it('日次集計を記録し平均応答時間を算出する', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-02T10:00:00.000Z'))

      service.onDiscordCommandStart({ commandName: 'roll', userId: 'u' })
      service.onDiscordCommandStart({ commandName: 'roll', userId: 'u' })
      service.onDiscordCommandComplete({ commandName: 'roll', success: true, duration: 100 })
      service.onDiscordCommandComplete({ commandName: 'roll', success: true, duration: 200 })

      service.aggregateDailyMetrics()

      const [key, data] = service.getTrends().daily[0]
      expect(key).toBe('2026-06-02')
      expect(data.totalCommands).toBe(2)
      // totalResponseTime 300 / commandsExecuted 2 = 150
      expect(data.avgDiscordResponseTime).toBe(150)

      jest.useRealTimers()
    })

    it('操作が無い場合の平均応答時間は 0（ゼロ除算ガード）', () => {
      service.aggregateDailyMetrics()

      const [, data] = service.getTrends().daily[0]
      expect(data.avgDiscordResponseTime).toBe(0)
      expect(data.avgHttpResponseTime).toBe(0)
      expect(data.avgDbResponseTime).toBe(0)
    })

    it('集計後に日次メトリクスをリセットする', () => {
      service.onDiscordCommandStart({ commandName: 'roll', userId: 'u' })
      service.aggregateDailyMetrics()

      expect(service.getSystemMetrics().discord.commandsExecuted).toBe(0)
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
      service.onDiscordCommandStart({ commandName: 'roll', userId: 'u' })
      service.onHttpRequestComplete({
        method: 'GET',
        url: '/x',
        statusCode: 200,
        duration: 1,
        success: true
      })
      service.aggregateHourlyMetrics()

      service.resetAllMetrics()

      const metrics = service.getSystemMetrics()
      expect(metrics.discord.commandsExecuted).toBe(0)
      expect(metrics.http.requests).toBe(0)
      expect(service.getTrends()).toEqual({ hourly: [], daily: [] })
    })
  })
})
