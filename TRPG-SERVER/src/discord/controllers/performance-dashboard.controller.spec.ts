import { Test } from '@nestjs/testing'
import { HttpException, HttpStatus } from '@nestjs/common'
import { PerformanceDashboardController } from './performance-dashboard.controller'
import { PerformanceOrchestratorService } from '../services/monitoring/performance-orchestrator.service'
import { AppConfigService } from '../../config/config.service'
import { JwtAuthGuard } from '../../domains/auth/guards/jwt-auth.guard'

// Controller は PerformanceOrchestratorService への委譲が責務。
// オーケストレーターは副作用境界としてモックし、各エンドポイントが
// 「正しいメソッドへ委譲し結果を返すか」「異常時に HttpException へ変換するか」を検証する。
type OrchestratorMock = {
  getPerformanceSummary: jest.Mock
  getSystemHealth: jest.Mock
  resetMonitoring: jest.Mock
}

describe('PerformanceDashboardController', () => {
  let orchestrator: OrchestratorMock
  let appConfig: { get: jest.Mock }
  let controller: PerformanceDashboardController

  // getPerformanceSummary が返す代表的なサマリ
  const buildSummary = () => ({
    system: { discord: {}, http: {}, database: {} },
    discord: {
      global: { uptime: 1, totalCalls: 10, totalErrors: 1, avgResponseTime: 100, errorRate: 0.1 },
      endpoints: [],
      alerts: ['critical-overload', 'minor-warning']
    },
    trends: { hourly: [], daily: [] },
    health: { status: 'healthy', issues: [], metrics: { avgResponseTime: 100, errorRate: 0.1, activeAlerts: 0 } },
    memory: process.memoryUsage(),
    uptime: 123
  })

  beforeEach(async () => {
    orchestrator = {
      getPerformanceSummary: jest.fn().mockReturnValue(buildSummary()),
      getSystemHealth: jest.fn().mockReturnValue({
        status: 'healthy',
        issues: [],
        metrics: { discord: { avgResponseTime: 100, errorRate: 0.1 }, alerts: { active: 0 } }
      }),
      resetMonitoring: jest.fn()
    }
    appConfig = { get: jest.fn().mockReturnValue('test') }

    const moduleRef = await Test.createTestingModule({
      controllers: [PerformanceDashboardController],
      providers: [
        { provide: PerformanceOrchestratorService, useValue: orchestrator },
        { provide: AppConfigService, useValue: appConfig }
      ]
    })
      // JwtAuthGuard は JwtTokenService 等に依存するため、認可は別テストの責務として無効化する
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = moduleRef.get(PerformanceDashboardController)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getPerformanceStats', () => {
    it('オーケストレーターのサマリをそのまま返す', async () => {
      // Arrange
      const summary = buildSummary()
      orchestrator.getPerformanceSummary.mockReturnValue(summary)

      // Act
      const result = await controller.getPerformanceStats()

      // Assert
      expect(result).toBe(summary)
      expect(orchestrator.getPerformanceSummary).toHaveBeenCalledTimes(1)
    })

    it('オーケストレーターが例外を投げると HttpException(500) に変換する', async () => {
      // Arrange
      orchestrator.getPerformanceSummary.mockImplementation(() => {
        throw new Error('boom')
      })

      // Act & Assert
      await expect(controller.getPerformanceStats()).rejects.toBeInstanceOf(HttpException)
      await expect(controller.getPerformanceStats()).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR
      })
    })
  })

  describe('getHealthStatus', () => {
    it('Discord ヘルスを集約し status と services を返す', async () => {
      // Act
      const result = await controller.getHealthStatus()

      // Assert
      expect(orchestrator.getSystemHealth).toHaveBeenCalledTimes(1)
      expect(result.status).toBe('healthy')
      expect(result.services.discord.status).toBe('healthy')
      expect(typeof result.timestamp).toBe('number')
    })

    it('ヒープ使用量が 800MB 超のとき warning に昇格し issue を追加する', async () => {
      // Arrange: process.memoryUsage を 900MB heapUsed に固定
      const mb = 1024 * 1024
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 0,
        heapTotal: 1000 * mb,
        heapUsed: 900 * mb,
        external: 0,
        arrayBuffers: 0
      } as NodeJS.MemoryUsage)

      // Act
      const result = await controller.getHealthStatus()

      // Assert
      expect(result.status).toBe('warning')
      expect(result.issues.some((i) => i.includes('High memory usage'))).toBe(true)
    })

    it('ヒープ使用量が 1200MB 超のとき critical になる', async () => {
      // Arrange
      const mb = 1024 * 1024
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 0,
        heapTotal: 2000 * mb,
        heapUsed: 1300 * mb,
        external: 0,
        arrayBuffers: 0
      } as NodeJS.MemoryUsage)

      // Act
      const result = await controller.getHealthStatus()

      // Assert
      expect(result.status).toBe('critical')
    })

    it('ヘルス取得で例外が出ると HttpException(500) に変換する', async () => {
      // Arrange
      orchestrator.getSystemHealth.mockImplementation(() => {
        throw new Error('boom')
      })

      // Act & Assert
      await expect(controller.getHealthStatus()).rejects.toBeInstanceOf(HttpException)
    })
  })

  describe('getDiscordStats', () => {
    it('discord セクションに rateLimit を付与して返す', async () => {
      // Act
      const result = await controller.getDiscordStats()

      // Assert
      expect(orchestrator.getPerformanceSummary).toHaveBeenCalledTimes(1)
      expect(result.alerts).toEqual(['critical-overload', 'minor-warning'])
      expect(result.rateLimit).toEqual({ status: 'normal', remaining: null, resetTime: null })
    })

    it('例外時は HttpException(500) に変換する', async () => {
      orchestrator.getPerformanceSummary.mockImplementation(() => {
        throw new Error('boom')
      })
      await expect(controller.getDiscordStats()).rejects.toBeInstanceOf(HttpException)
    })
  })

  describe('getTimeSeriesMetrics', () => {
    it('hourly トレンドから response_time を平均で算出する', async () => {
      // Arrange: 2 期間分のデータ。avg = (100/2 + 200/4)/... の手計算で検証
      const summary = buildSummary()
      summary.trends.hourly = [
        ['12:00', { timestamp: 1000, discord: { totalResponseTime: 100, commandsExecuted: 2 } }],
        ['13:00', { timestamp: 2000, discord: { totalResponseTime: 200, commandsExecuted: 4 } }]
      ] as never
      orchestrator.getPerformanceSummary.mockReturnValue(summary)

      // Act
      const result = await controller.getTimeSeriesMetrics('24h', 'response_time')

      // Assert: 50ms と 50ms → avg 50, data 2 件
      expect(result.metric).toBe('response_time')
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toEqual({ timestamp: 1000, value: 50, label: '12:00' })
      expect(result.summary.avg).toBe(50)
    })

    it('throughput では合計値 total が summary に含まれる', async () => {
      // Arrange
      const summary = buildSummary()
      summary.trends.hourly = [
        [
          '12:00',
          { timestamp: 1000, discord: { commandsExecuted: 3 }, http: { requests: 2 }, database: { queries: 1 } }
        ]
      ] as never
      orchestrator.getPerformanceSummary.mockReturnValue(summary)

      // Act
      const result = await controller.getTimeSeriesMetrics('1h', 'throughput')

      // Assert: 3+2+1 = 6
      expect(result.data[0].value).toBe(6)
      expect(result.summary.total).toBe(6)
    })

    it('データが無い場合は summary を 0 埋めし data は空になる', async () => {
      // Act: デフォルトの空 trends
      const result = await controller.getTimeSeriesMetrics('24h', 'response_time')

      // Assert
      expect(result.data).toEqual([])
      expect(result.summary).toEqual({ min: 0, max: 0, avg: 0 })
    })

    it('7d 指定では daily トレンドを参照する', async () => {
      // Arrange
      const summary = buildSummary()
      summary.trends.daily = [
        ['day1', { timestamp: 5000, discord: { commandsExecuted: 10 }, http: {}, database: {} }]
      ] as never
      orchestrator.getPerformanceSummary.mockReturnValue(summary)

      // Act
      const result = await controller.getTimeSeriesMetrics('7d', 'throughput')

      // Assert
      expect(result.data).toHaveLength(1)
      expect(result.data[0].value).toBe(10)
    })

    it('例外時は HttpException(500) に変換する', async () => {
      orchestrator.getPerformanceSummary.mockImplementation(() => {
        throw new Error('boom')
      })
      await expect(controller.getTimeSeriesMetrics('24h', 'response_time')).rejects.toBeInstanceOf(HttpException)
    })
  })

  describe('getActiveAlerts', () => {
    it('アラートを critical/warning に分類して件数を返す', async () => {
      // Act
      const result = await controller.getActiveAlerts()

      // Assert: 'critical-overload' のみ critical 扱い
      expect(result.alertCount).toBe(2)
      expect(result.criticalCount).toBe(1)
      expect(result.warningCount).toBe(1)
    })

    it('例外時は HttpException(500) に変換する', async () => {
      orchestrator.getPerformanceSummary.mockImplementation(() => {
        throw new Error('boom')
      })
      await expect(controller.getActiveAlerts()).rejects.toBeInstanceOf(HttpException)
    })
  })

  describe('resetMetrics', () => {
    it('resetMonitoring を呼び成功レスポンスを返す', async () => {
      // Act
      const result = await controller.resetMetrics()

      // Assert
      expect(orchestrator.resetMonitoring).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
    })

    it('resetMonitoring が投げると HttpException(500) に変換する', async () => {
      orchestrator.resetMonitoring.mockImplementation(() => {
        throw new Error('boom')
      })
      await expect(controller.resetMetrics()).rejects.toBeInstanceOf(HttpException)
    })
  })

  describe('getSystemInfo', () => {
    it('AppConfigService から environment を取得しシステム情報を返す', async () => {
      // Act
      const result = await controller.getSystemInfo()

      // Assert
      expect(appConfig.get).toHaveBeenCalledWith('app.environment')
      expect(result.environment.nodeEnv).toBe('test')
      expect(result.node.version).toBe(process.version)
      expect(result.process.pid).toBe(process.pid)
    })

    it('設定取得で例外が出ると HttpException(500) に変換する', async () => {
      appConfig.get.mockImplementation(() => {
        throw new Error('boom')
      })
      await expect(controller.getSystemInfo()).rejects.toBeInstanceOf(HttpException)
    })
  })
})
