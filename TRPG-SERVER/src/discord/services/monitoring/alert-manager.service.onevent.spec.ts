import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
import { AlertManagerService } from './alert-manager.service'

/**
 * イベント配線（@OnEvent）の characterization テスト。
 * 旧 metrics-collector.service.onevent.spec.ts の後継。C-3b′（2026-07-07）で dead 配線
 * （metrics-collector の @OnEvent 5 本・alert-manager の @OnEvent('system.alert')）を撤去したため、
 * monitoring に残る唯一の live 購読である 'system.health.status'
 * （emit 元: performance-orchestrator.performPeriodicHealthCheck）の forRoot 配線を固定する。
 *
 * 目的:
 *   EventEmitterModule.forRoot(...) が提供するグローバル EventEmitter2 から、
 *   `@OnEvent` デコレータ付きハンドラーが「emit 経由」で発火することを固定する。
 *   メソッド直呼びのユニットテスト（alert-manager.service.spec.ts）とは別に、
 *   forRoot 配線そのものの回帰テストとして機能する。
 *
 * 設定値は統合後に採用される events 側の値（maxListeners:20 / verboseMemoryLeak:true）を
 * 使用する。配線挙動はこれらの値に依存しないため、いずれの設定でも本テストは緑になる。
 */
describe('AlertManagerService @OnEvent 配線（emit 経由）', () => {
  let module: TestingModule
  let service: AlertManagerService
  let eventEmitter: EventEmitter2

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({
          wildcard: false,
          delimiter: '.',
          newListener: false,
          removeListener: false,
          maxListeners: 20,
          verboseMemoryLeak: true,
          ignoreErrors: false
        })
      ],
      providers: [AlertManagerService]
    }).compile()

    // @OnEvent の購読登録は onApplicationBootstrap で行われるため init() が必須。
    await module.init()

    service = module.get<AlertManagerService>(AlertManagerService)
    eventEmitter = module.get<EventEmitter2>(EventEmitter2)
  })

  afterEach(async () => {
    await module.close()
  })

  describe('system.health.status（live ペア: performance-orchestrator が emit）', () => {
    it('エラー率がしきい値超のヘルスを emit するとハンドラが発火しアラートが記録される（emit 経由）', async () => {
      // Arrange
      expect(service.getActiveAlerts()).toHaveLength(0)

      // Act: emitAsync で async ハンドラの完了を待つ
      await eventEmitter.emitAsync('system.health.status', {
        status: 'critical',
        timestamp: Date.now(),
        metrics: { errorRate: 0.5 },
        issues: []
      })

      // Assert: high-error-rate ルールの triggerAlert 副作用が観測できる
      const alerts = service.getActiveAlerts()
      expect(alerts.map((a) => a.ruleId)).toContain('high-error-rate')
    })

    it('しきい値内のヘルスを emit してもアラートは記録されない', async () => {
      // Act
      await eventEmitter.emitAsync('system.health.status', {
        status: 'healthy',
        timestamp: Date.now(),
        metrics: { errorRate: 0, memory: { heapUsedMB: 100 } },
        issues: []
      })

      // Assert
      expect(service.getActiveAlerts()).toHaveLength(0)
    })
  })
})
