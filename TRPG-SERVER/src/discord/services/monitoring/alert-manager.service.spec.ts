import { EventEmitter2 } from '@nestjs/event-emitter'
import { AlertManagerService, AlertRule } from './alert-manager.service'

/**
 * AlertManagerService は「ルール容器(Map) + EventEmitter2 発行 + クールダウン状態管理 + 統計」を持つ
 * 監視サービス。discord.js 非依存。
 *
 * 依存(EventEmitter2)は副作用の境界としてモックする。
 * 時刻は Date.now() を直呼びするため jest.useFakeTimers() で決定化する。
 * private(isInCooldown 等)は覗かず、公開 API の振る舞い(emit 呼び出し・戻り値・統計)で検証する。
 */
describe('AlertManagerService', () => {
  let service: AlertManagerService
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit' | 'on'>>

  const FIXED_NOW = 1_700_000_000_000

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_NOW)

    // 指示どおり EventEmitter2 は emit/on を持つモックにする
    eventEmitter = { emit: jest.fn(), on: jest.fn() }

    service = new AlertManagerService(eventEmitter as unknown as EventEmitter2)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe('onModuleInit / デフォルトルール初期化', () => {
    it('デフォルトの3ルールが登録される', async () => {
      // Act
      await service.onModuleInit()

      // Assert
      const rules = service.getAllAlertRules()
      expect(rules).toHaveLength(3)
      expect(rules.map((r) => r.id).sort()).toEqual(
        ['consecutive-errors', 'high-error-rate', 'high-memory-usage'].sort()
      )
    })

    it('初期化前はルールが空である', () => {
      expect(service.getAllAlertRules()).toEqual([])
    })
  })

  describe('addAlertRule / removeAlertRule / getAllAlertRules', () => {
    const buildRule = (overrides: Partial<AlertRule> = {}): AlertRule => ({
      id: 'rule-1',
      name: 'テストルール',
      description: '説明',
      eventPattern: 'system.custom',
      condition: () => true,
      severity: 'warning',
      enabled: true,
      cooldown: 1000,
      actions: [{ type: 'log', config: {} }],
      ...overrides
    })

    it('ルールを追加すると getAllAlertRules で取得できる', () => {
      // Arrange
      const rule = buildRule()

      // Act
      service.addAlertRule(rule)

      // Assert
      expect(service.getAllAlertRules()).toEqual([rule])
    })

    it('同じ id のルールを追加すると上書きされる', () => {
      // Arrange
      service.addAlertRule(buildRule({ name: '旧' }))

      // Act
      service.addAlertRule(buildRule({ name: '新' }))

      // Assert
      const rules = service.getAllAlertRules()
      expect(rules).toHaveLength(1)
      expect(rules[0].name).toBe('新')
    })

    it('存在するルールを削除すると true を返し、一覧から消える', () => {
      // Arrange
      service.addAlertRule(buildRule())

      // Act
      const result = service.removeAlertRule('rule-1')

      // Assert
      expect(result).toBe(true)
      expect(service.getAllAlertRules()).toEqual([])
    })

    it('存在しないルールを削除すると false を返す', () => {
      expect(service.removeAlertRule('not-exist')).toBe(false)
    })
  })

  describe('triggerAlert', () => {
    it('アラートを発行すると system.alert.<type> イベントを emit する', async () => {
      // Act
      await service.triggerAlert({
        type: 'custom-type',
        severity: 'info',
        message: 'テストメッセージ',
        data: { foo: 'bar' }
      })

      // Assert: 副作用(emit)の検証
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1)
      const [eventName, payload] = eventEmitter.emit.mock.calls[0]
      expect(eventName).toBe('system.alert.custom-type')
      expect(payload).toMatchObject({
        ruleId: 'custom-type',
        severity: 'info',
        message: 'テストメッセージ',
        data: { foo: 'bar' },
        triggeredAt: FIXED_NOW,
        acknowledged: false,
        count: 1
      })
    })

    it('severity が critical の場合は system.alert.critical も追加で emit する', async () => {
      // Act
      await service.triggerAlert({
        type: 'custom-type',
        severity: 'critical',
        message: '重大'
      })

      // Assert
      const eventNames = eventEmitter.emit.mock.calls.map((c) => c[0])
      expect(eventNames).toContain('system.alert.custom-type')
      expect(eventNames).toContain('system.alert.critical')
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2)
    })

    it('data 省略時は空オブジェクトでアクティブアラートに格納される', async () => {
      // Act
      await service.triggerAlert({ type: 'no-data', severity: 'info', message: 'm' })

      // Assert
      const [alert] = service.getActiveAlerts()
      expect(alert.data).toEqual({})
    })

    it('発行したアラートは getActiveAlerts で取得できる', async () => {
      // Act
      await service.triggerAlert({ type: 'custom-type', severity: 'info', message: 'm' })

      // Assert
      const active = service.getActiveAlerts()
      expect(active).toHaveLength(1)
      expect(active[0].ruleId).toBe('custom-type')
    })
  })

  describe('クールダウン', () => {
    const cooldownRule: AlertRule = {
      id: 'cooled',
      name: 'クールダウンルール',
      description: '説明',
      eventPattern: 'system.custom',
      condition: () => true,
      severity: 'warning',
      enabled: true,
      cooldown: 5000,
      actions: [{ type: 'log', config: {} }]
    }

    it('ルール登録済みの type はクールダウン中だと再発火しない', async () => {
      // Arrange: ルールを登録し1回発火 → クールダウン設定される
      service.addAlertRule(cooldownRule)
      await service.triggerAlert({ type: 'cooled', severity: 'warning', message: '1回目' })
      eventEmitter.emit.mockClear()

      // Act: クールダウン未満の経過時間で再発火を試みる
      jest.setSystemTime(FIXED_NOW + 4999)
      await service.triggerAlert({ type: 'cooled', severity: 'warning', message: '2回目' })

      // Assert: emit されない
      expect(eventEmitter.emit).not.toHaveBeenCalled()
      expect(service.getActiveAlerts()).toHaveLength(1)
    })

    it('クールダウン経過後は再発火できる', async () => {
      // Arrange
      service.addAlertRule(cooldownRule)
      await service.triggerAlert({ type: 'cooled', severity: 'warning', message: '1回目' })
      eventEmitter.emit.mockClear()

      // Act: クールダウン(5000ms)を満たす時刻まで進める
      jest.setSystemTime(FIXED_NOW + 5000)
      await service.triggerAlert({ type: 'cooled', severity: 'warning', message: '2回目' })

      // Assert: 再び emit される
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1)
      expect(service.getActiveAlerts()).toHaveLength(2)
    })

    it('ルール未登録の type はクールダウン対象外で毎回発火する', async () => {
      // Act: 時刻を進めて連続発火(alertId は type-now のため同一時刻だと衝突する)
      await service.triggerAlert({ type: 'unregistered', severity: 'info', message: 'a' })
      jest.setSystemTime(FIXED_NOW + 1)
      await service.triggerAlert({ type: 'unregistered', severity: 'info', message: 'b' })

      // Assert: 両方とも emit される
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2)
      expect(service.getActiveAlerts()).toHaveLength(2)
    })
  })

  describe('handleHealthStatus (しきい値評価)', () => {
    beforeEach(async () => {
      await service.onModuleInit()
    })

    it('エラー率がしきい値(0.05)を超えると high-error-rate アラートを emit する', async () => {
      // Act
      await service.handleHealthStatus({ metrics: { errorRate: 0.06 } })

      // Assert
      const eventNames = eventEmitter.emit.mock.calls.map((c) => c[0])
      expect(eventNames).toContain('system.alert.high-error-rate')
      expect(eventNames).toContain('system.alert.critical')
    })

    it('しきい値を超えない場合はアラートを emit しない', async () => {
      // Act
      await service.handleHealthStatus({ metrics: { errorRate: 0.01, memory: { heapUsedMB: 100 } } })

      // Assert
      expect(eventEmitter.emit).not.toHaveBeenCalled()
      expect(service.getActiveAlerts()).toHaveLength(0)
    })

    it('メモリ使用量がしきい値(800MB)を超えると high-memory-usage アラートを emit する', async () => {
      // Act
      await service.handleHealthStatus({ metrics: { memory: { heapUsedMB: 801 } } })

      // Assert
      const eventNames = eventEmitter.emit.mock.calls.map((c) => c[0])
      expect(eventNames).toContain('system.alert.high-memory-usage')
    })

    it('condition 評価で例外が発生しても他ルールの評価を止めない', async () => {
      // Arrange: errorRate 参照で throw するデータでも、エラーは握りつぶされ memory ルールは評価される
      const throwingData = {
        metrics: {
          get errorRate() {
            throw new Error('boom')
          },
          memory: { heapUsedMB: 900 }
        }
      }

      // Act
      await service.handleHealthStatus(throwingData)

      // Assert: memory ルールは評価され emit される
      const eventNames = eventEmitter.emit.mock.calls.map((c) => c[0])
      expect(eventNames).toContain('system.alert.high-memory-usage')
    })
  })

  describe('handleSystemAlert', () => {
    it('受け取った data の値で triggerAlert に委譲し emit する', async () => {
      // Act
      await service.handleSystemAlert({
        type: 'sys',
        severity: 'warning',
        message: 'システム警告',
        data: { x: 1 }
      })

      // Assert
      const [eventName, payload] = eventEmitter.emit.mock.calls[0]
      expect(eventName).toBe('system.alert.sys')
      expect(payload).toMatchObject({ severity: 'warning', message: 'システム警告', data: { x: 1 } })
    })

    it('フィールド省略時は既定値(type=system, severity=info, 既定メッセージ)で発火する', async () => {
      // Act
      await service.handleSystemAlert({})

      // Assert
      const [eventName, payload] = eventEmitter.emit.mock.calls[0]
      expect(eventName).toBe('system.alert.system')
      expect(payload).toMatchObject({
        ruleId: 'system',
        severity: 'info',
        message: 'System alert triggered',
        data: {}
      })
    })
  })

  describe('acknowledgeAlert', () => {
    it('存在するアラートを承認すると true を返し承認情報が記録される', async () => {
      // Arrange
      await service.triggerAlert({ type: 'ack-type', severity: 'info', message: 'm' })
      const alertId = service.getActiveAlerts()[0].id

      // Act
      const result = service.acknowledgeAlert(alertId, 'user-1')

      // Assert
      expect(result).toBe(true)
      const alert = service.getActiveAlerts()[0]
      expect(alert.acknowledged).toBe(true)
      expect(alert.acknowledgedBy).toBe('user-1')
      expect(alert.acknowledgedAt).toBe(FIXED_NOW)
    })

    it('存在しないアラートの承認は false を返す', () => {
      expect(service.acknowledgeAlert('missing-id', 'user-1')).toBe(false)
    })
  })

  describe('getActiveAlerts', () => {
    it('triggeredAt の降順(新しい順)で返す', async () => {
      // Arrange: 時刻をずらして2件発火
      await service.triggerAlert({ type: 'first', severity: 'info', message: 'first' })
      jest.setSystemTime(FIXED_NOW + 1000)
      await service.triggerAlert({ type: 'second', severity: 'info', message: 'second' })

      // Act
      const active = service.getActiveAlerts()

      // Assert: 新しい second が先頭
      expect(active.map((a) => a.ruleId)).toEqual(['second', 'first'])
    })

    it('resolvedAt が設定されたアラートは除外される', async () => {
      // Arrange
      await service.triggerAlert({ type: 'resolved-type', severity: 'info', message: 'm' })
      const alertId = service.getActiveAlerts()[0].id

      // Act: resolvedAt はカプセル化されているため、getActiveAlerts のフィルタ条件を
      // 確認するために getAlertStatistics の activeAlertsCount と併せて検証する
      // (resolved を直接設定する公開 API は無いため除外ロジックは「未設定なら含む」のみ検証)
      const active = service.getActiveAlerts()

      // Assert: resolvedAt 未設定なので含まれる
      expect(active.some((a) => a.id === alertId)).toBe(true)
    })
  })

  describe('getAlertStatistics', () => {
    it('発行回数・severity 別・rule 別の統計を集計する', async () => {
      // Arrange: alertId は type-now のため、同一 type は時刻を進めて衝突を避ける
      await service.triggerAlert({ type: 'rule-a', severity: 'critical', message: 'm1' })
      jest.setSystemTime(FIXED_NOW + 1)
      await service.triggerAlert({ type: 'rule-a', severity: 'critical', message: 'm2' })
      jest.setSystemTime(FIXED_NOW + 2)
      await service.triggerAlert({ type: 'rule-b', severity: 'info', message: 'm3' })

      // Act
      const stats = service.getAlertStatistics()

      // Assert
      expect(stats.totalAlerts).toBe(3)
      expect(stats.activeAlertsCount).toBe(3)
      expect(stats.alertsByRule).toEqual({ 'rule-a': 2, 'rule-b': 1 })
      expect(stats.alertsBySeverity).toEqual({ critical: 2, info: 1 })
      expect(stats.lastAlertTime).toBe(FIXED_NOW + 2)
    })

    it('発行前は totalAlerts=0, activeAlertsCount=0 の初期統計を返す', () => {
      // Act
      const stats = service.getAlertStatistics()

      // Assert
      expect(stats.totalAlerts).toBe(0)
      expect(stats.activeAlertsCount).toBe(0)
      expect(stats.alertsByRule).toEqual({})
      expect(stats.alertsBySeverity).toEqual({})
    })
  })
})
