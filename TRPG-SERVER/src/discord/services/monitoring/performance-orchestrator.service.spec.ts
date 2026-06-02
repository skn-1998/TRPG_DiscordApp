import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PerformanceOrchestratorService } from './performance-orchestrator.service'
import { MetricsCollectorService } from './metrics-collector.service'
import { AlertManagerService } from './alert-manager.service'
import { DiscordMonitorService } from './discord-monitor.service'

/**
 * PerformanceOrchestratorService は監視サービス群(MetricsCollector/AlertManager/DiscordMonitor)を
 * 統合管理する委譲オーケストレーター。各依存を mock し、
 * getSystemHealth のステータス判定分岐(healthy/warning/critical)・委譲メソッド・
 * 定期処理(ヘルスチェック/メンテナンス)のイベント発行と例外握りつぶしを検証する。
 */
describe('PerformanceOrchestratorService', () => {
  let service: PerformanceOrchestratorService
  let metricsCollector: jest.Mocked<Pick<MetricsCollectorService, 'getSystemMetrics' | 'getTrends'>>
  let alertManager: jest.Mocked<Pick<AlertManagerService, 'getAlertStatistics' | 'triggerAlert'>>
  let discordMonitor: jest.Mocked<
    Pick<
      DiscordMonitorService,
      'getHealthStatus' | 'getStats' | 'performMaintenance' | 'startApiCall' | 'recordRateLimit' | 'reset'
    >
  >
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>

  // 各依存の「健全」な既定戻り値を返すヘルパー
  const setHealthy = () => {
    discordMonitor.getHealthStatus.mockReturnValue({
      status: 'healthy',
      issues: [],
      metrics: {}
    } as never)
    metricsCollector.getSystemMetrics.mockReturnValue({
      memory: { heapUsedMB: 100, rss: 1, heapTotal: 2, heapUsed: 1, external: 0 },
      discord: {},
      http: {},
      database: {},
      startTime: 0
    } as never)
    alertManager.getAlertStatistics.mockReturnValue({
      activeAlertsCount: 0,
      totalAlerts: 0
    } as never)
  }

  beforeEach(async () => {
    metricsCollector = {
      getSystemMetrics: jest.fn(),
      getTrends: jest.fn().mockReturnValue({})
    }
    alertManager = {
      getAlertStatistics: jest.fn(),
      triggerAlert: jest.fn().mockResolvedValue(undefined)
    }
    discordMonitor = {
      getHealthStatus: jest.fn(),
      getStats: jest.fn().mockReturnValue({ global: { avgResponseTime: 0, errorRate: 0 }, alerts: [] }),
      performMaintenance: jest.fn(),
      startApiCall: jest.fn(),
      recordRateLimit: jest.fn(),
      reset: jest.fn()
    }
    eventEmitter = {
      emit: jest.fn()
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        PerformanceOrchestratorService,
        { provide: MetricsCollectorService, useValue: metricsCollector },
        { provide: AlertManagerService, useValue: alertManager },
        { provide: DiscordMonitorService, useValue: discordMonitor },
        { provide: EventEmitter2, useValue: eventEmitter }
      ]
    }).compile()

    service = moduleRef.get(PerformanceOrchestratorService)
    setHealthy()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getSystemHealth', () => {
    it('全て正常なら healthy・issues 空を返す', () => {
      // Act
      const health = service.getSystemHealth()

      // Assert
      expect(health.status).toBe('healthy')
      expect(health.issues).toEqual([])
      expect(health.metrics.alerts).toEqual({ active: 0, total: 0 })
    })

    it('Discord監視が warning なら warning へ昇格し issues を引き継ぐ', () => {
      // Arrange
      discordMonitor.getHealthStatus.mockReturnValue({
        status: 'warning',
        issues: ['discord遅延'],
        metrics: {}
      } as never)

      // Act
      const health = service.getSystemHealth()

      // Assert
      expect(health.status).toBe('warning')
      expect(health.issues).toContain('discord遅延')
    })

    it('Discord監視が critical なら critical を返す', () => {
      // Arrange
      discordMonitor.getHealthStatus.mockReturnValue({
        status: 'critical',
        issues: ['discord停止'],
        metrics: {}
      } as never)

      // Act
      const health = service.getSystemHealth()

      // Assert
      expect(health.status).toBe('critical')
    })

    it('メモリが800MB超で warning、issues にメモリ警告を積む', () => {
      // Arrange
      metricsCollector.getSystemMetrics.mockReturnValue({
        memory: { heapUsedMB: 900 },
        discord: {},
        http: {},
        database: {},
        startTime: 0
      } as never)

      // Act
      const health = service.getSystemHealth()

      // Assert
      expect(health.status).toBe('warning')
      expect(health.issues.some((i) => i.includes('High memory usage'))).toBe(true)
    })

    it('メモリが1000MB超で critical', () => {
      // Arrange
      metricsCollector.getSystemMetrics.mockReturnValue({
        memory: { heapUsedMB: 1100 },
        discord: {},
        http: {},
        database: {},
        startTime: 0
      } as never)

      // Act
      const health = service.getSystemHealth()

      // Assert
      expect(health.status).toBe('critical')
    })

    it('アクティブアラートが5件超で critical', () => {
      // Arrange
      alertManager.getAlertStatistics.mockReturnValue({
        activeAlertsCount: 6,
        totalAlerts: 10
      } as never)

      // Act
      const health = service.getSystemHealth()

      // Assert
      expect(health.status).toBe('critical')
      expect(health.issues.some((i) => i.includes('Too many active alerts'))).toBe(true)
    })

    it('アクティブアラートが2件超5件以下で warning', () => {
      // Arrange
      alertManager.getAlertStatistics.mockReturnValue({
        activeAlertsCount: 3,
        totalAlerts: 5
      } as never)

      // Act
      const health = service.getSystemHealth()

      // Assert
      expect(health.status).toBe('warning')
    })
  })

  describe('performPeriodicHealthCheck', () => {
    it('ヘルスステータスをイベント発行する', async () => {
      // Act
      await service.performPeriodicHealthCheck()

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'system.health.status',
        expect.objectContaining({ status: 'healthy' })
      )
    })

    it('内部で例外が発生してもイベントを発行せず握りつぶす(throwしない)', async () => {
      // Arrange
      discordMonitor.getHealthStatus.mockImplementation(() => {
        throw new Error('監視失敗')
      })

      // Act / Assert
      await expect(service.performPeriodicHealthCheck()).resolves.toBeUndefined()
      expect(eventEmitter.emit).not.toHaveBeenCalled()
    })
  })

  describe('performMaintenance', () => {
    it('discordMonitor.performMaintenance に委譲する', async () => {
      // Act
      await service.performMaintenance()

      // Assert
      expect(discordMonitor.performMaintenance).toHaveBeenCalled()
    })

    it('メンテナンス中に例外が発生しても throw しない', async () => {
      // Arrange
      discordMonitor.performMaintenance.mockImplementation(() => {
        throw new Error('メンテ失敗')
      })

      // Act / Assert
      await expect(service.performMaintenance()).resolves.toBeUndefined()
    })
  })

  describe('getPerformanceSummary', () => {
    it('各依存から集計したサマリーを返す', () => {
      // Arrange
      metricsCollector.getSystemMetrics.mockReturnValue({
        memory: { heapUsedMB: 100, rss: 10, heapTotal: 20, heapUsed: 15, external: 1 },
        discord: { d: 1 },
        http: { h: 1 },
        database: { db: 1 },
        startTime: 0
      } as never)
      discordMonitor.getStats.mockReturnValue({
        global: { avgResponseTime: 50, errorRate: 0.1 },
        alerts: []
      } as never)

      // Act
      const summary = service.getPerformanceSummary()

      // Assert
      expect(summary.system.discord).toEqual({ d: 1 })
      expect(summary.memory.rss).toBe(10 * 1024 * 1024)
      expect(summary.health.status).toBe('healthy')
      expect(summary.health.metrics.avgResponseTime).toBe(50)
    })
  })

  describe('委譲メソッド', () => {
    it('startDiscordApiMonitoring は discordMonitor.startApiCall に委譲する', () => {
      // Arrange
      discordMonitor.startApiCall.mockReturnValue('handle' as never)

      // Act
      const result = service.startDiscordApiMonitoring('/endpoint', 'POST')

      // Assert
      expect(discordMonitor.startApiCall).toHaveBeenCalledWith('/endpoint', 'POST')
      expect(result).toBe('handle')
    })

    it('startDiscordApiMonitoring は method 既定値 GET で委譲する', () => {
      // Act
      service.startDiscordApiMonitoring('/endpoint')

      // Assert
      expect(discordMonitor.startApiCall).toHaveBeenCalledWith('/endpoint', 'GET')
    })

    it('recordRateLimit は discordMonitor.recordRateLimit に委譲する', () => {
      // Act
      service.recordRateLimit('/e', 5, 10, 123)

      // Assert
      expect(discordMonitor.recordRateLimit).toHaveBeenCalledWith('/e', 5, 10, 123)
    })

    it('triggerAlert は alertManager.triggerAlert に委譲する', async () => {
      // Arrange
      const alert = { type: 't', severity: 'warning' as const, message: 'm' }

      // Act
      await service.triggerAlert(alert)

      // Assert
      expect(alertManager.triggerAlert).toHaveBeenCalledWith(alert)
    })

    it('resetMonitoring は discordMonitor.reset に委譲する', () => {
      // Act
      service.resetMonitoring()

      // Assert
      expect(discordMonitor.reset).toHaveBeenCalled()
    })
  })

  describe('onModuleInit', () => {
    it('初期ヘルスを評価し monitoring.system.started イベントを発行する', async () => {
      // Act
      await service.onModuleInit()

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'monitoring.system.started',
        expect.objectContaining({ health: expect.objectContaining({ status: 'healthy' }) })
      )
    })
  })
})
