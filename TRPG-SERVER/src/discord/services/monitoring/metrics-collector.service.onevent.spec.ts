import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
import { MetricsCollectorService } from './metrics-collector.service'
import { AlertManagerService } from './alert-manager.service'

/**
 * イベント配線（@OnEvent）の characterization テスト。
 *
 * 目的:
 *   EventEmitterModule.forRoot(...) が提供するグローバル EventEmitter2 から、
 *   `@OnEvent` デコレータ付きハンドラーが「emit 経由」で発火することを固定する。
 *   メソッド直呼びのユニットテスト（metrics-collector.service.spec.ts）とは別に、
 *   forRoot 配線そのものの回帰テストとして機能する。
 *
 * 背景:
 *   現状 forRoot は core-events.module.ts と events.module.ts で二重に呼ばれている。
 *   次フェーズで events.module.ts 側の forRoot を削除し core-events.module.ts に
 *   統一する（設定は events 側の値 maxListeners:20 / verboseMemoryLeak:true に寄せる）。
 *   この往復テストが「統合後も緑」であれば、@OnEvent 配線が壊れていないことの証明になる。
 *
 * 設定値は統合後に採用される events 側の値（maxListeners:20 / verboseMemoryLeak:true）を
 * 使用する。配線挙動はこれらの値に依存しないため、いずれの設定でも本テストは緑になる。
 */
describe('MetricsCollectorService @OnEvent 配線（emit 経由）', () => {
  let module: TestingModule
  let service: MetricsCollectorService
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
      providers: [MetricsCollectorService]
    }).compile()

    // @OnEvent の購読登録は onApplicationBootstrap で行われるため init() が必須。
    await module.init()

    service = module.get<MetricsCollectorService>(MetricsCollectorService)
    eventEmitter = module.get<EventEmitter2>(EventEmitter2)
  })

  afterEach(async () => {
    await module.close()
  })

  describe('discord.command.start', () => {
    it('emit するとハンドラが発火し commandsExecuted が増える（メソッド直呼びではない）', () => {
      // Arrange
      const before = service.getSystemMetrics().discord.commandsExecuted

      // Act: emit 経由でハンドラを発火させる
      eventEmitter.emit('discord.command.start', {
        commandName: 'roll',
        userId: 'user-1',
        guildId: 'guild-1'
      })

      // Assert
      expect(service.getSystemMetrics().discord.commandsExecuted).toBe(before + 1)
    })

    it('複数回 emit すると累積する', () => {
      // Act
      eventEmitter.emit('discord.command.start', { commandName: 'a', userId: 'u1' })
      eventEmitter.emit('discord.command.start', { commandName: 'b', userId: 'u2' })

      // Assert
      expect(service.getSystemMetrics().discord.commandsExecuted).toBe(2)
    })
  })

  describe('discord.command.complete', () => {
    it('成功イベントを emit すると totalResponseTime に加算されエラーは増えない', () => {
      // Act
      eventEmitter.emit('discord.command.complete', {
        commandName: 'roll',
        success: true,
        duration: 120
      })

      // Assert
      const discord = service.getSystemMetrics().discord
      expect(discord.totalResponseTime).toBe(120)
      expect(discord.errors).toBe(0)
    })

    it('失敗イベントを emit すると errors がインクリメントされ totalResponseTime にも加算される', () => {
      // Act
      eventEmitter.emit('discord.command.complete', {
        commandName: 'roll',
        success: false,
        duration: 50,
        error: 'boom'
      })

      // Assert
      const discord = service.getSystemMetrics().discord
      expect(discord.totalResponseTime).toBe(50)
      expect(discord.errors).toBe(1)
    })
  })
})

/**
 * AlertManagerService の @OnEvent('system.alert') 配線テスト。
 * ConfigService を依存に持つため最小モックを provider 登録する。
 * emit 経由でハンドラが発火し triggerAlert の副作用（activeAlerts 追加）が起きることを固定する。
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
      providers: [
        AlertManagerService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() }
        }
      ]
    }).compile()

    await module.init()

    service = module.get<AlertManagerService>(AlertManagerService)
    eventEmitter = module.get<EventEmitter2>(EventEmitter2)
  })

  afterEach(async () => {
    await module.close()
  })

  describe('system.alert', () => {
    it('emit するとハンドラが発火しアクティブアラートが1件追加される（emit 経由）', async () => {
      // Arrange
      expect(service.getActiveAlerts()).toHaveLength(0)

      // Act: emitAsync で async ハンドラの完了を待つ
      await eventEmitter.emitAsync('system.alert', {
        type: 'test-alert',
        severity: 'warning',
        message: 'configuration drift detected',
        data: { foo: 'bar' }
      })

      // Assert: triggerAlert の副作用が観測できる
      const alerts = service.getActiveAlerts()
      expect(alerts).toHaveLength(1)
      expect(alerts[0].severity).toBe('warning')
      expect(alerts[0].message).toBe('configuration drift detected')
    })
  })
})
