import { Test } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { EventRegistryService } from './event-registry.service'
import { TypedEventService } from '../core/events/typed-event.service'
import { CharacterCreationRequestedHandler } from './handlers/character.creation.requested'
import { CharacterUpdateRequestedHandler } from './handlers/character.update.requested'
import { CharacterFindByChannelIdRequestedHandler } from './handlers/character.findByChannelId.requested'
import { CharacterFindByIdRequestedHandler } from './handlers/character.findById.requested'
import { CharacterFindByNameRequestedHandler } from './handlers/character.findByName.requested'

/**
 * EventRegistryService のユニットテスト
 *
 * 方針: 副作用の境界（TypedEventService）と 5 ハンドラを mock スタブで注入し、
 *       実ハンドラの依存解決を回避する。純粋ロジック（isValidEventName / stats 更新 /
 *       healthReport 判定 / 相関ID生成）は private のため型アサーションで直接検証する。
 *       本番コードは一切変更しない。
 */

/** EventHandler の最小スタブを生成する */
function createHandlerStub(eventName: string, name = 'StubHandler') {
  const stub = {
    getEventName: jest.fn(() => eventName),
    handle: jest.fn(async (_event: any, _context?: any) => undefined),
    execute: jest.fn(async (_event: any, _context?: any) => undefined),
    setTypedEventService: jest.fn()
  }
  // constructor.name を登録ログ等で参照するため固定
  Object.defineProperty(stub, 'constructor', { value: { name } })
  return stub
}

describe('EventRegistryService', () => {
  let service: EventRegistryService
  let typedEventService: { on: jest.Mock; emit: jest.Mock }
  let creationHandler: ReturnType<typeof createHandlerStub>
  let updateHandler: ReturnType<typeof createHandlerStub>
  let findByChannelIdHandler: ReturnType<typeof createHandlerStub>
  let findByIdHandler: ReturnType<typeof createHandlerStub>
  let findByNameHandler: ReturnType<typeof createHandlerStub>

  beforeEach(async () => {
    // ログ出力をテスト出力から抑制
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    typedEventService = { on: jest.fn(), emit: jest.fn() }

    creationHandler = createHandlerStub('character.creation.requested', 'CreationHandler')
    updateHandler = createHandlerStub('character.update.requested', 'UpdateHandler')
    findByChannelIdHandler = createHandlerStub('character.findByChannelId.requested', 'FindByChannelIdHandler')
    findByIdHandler = createHandlerStub('character.findById.requested', 'FindByIdHandler')
    findByNameHandler = createHandlerStub('character.findByName.requested', 'FindByNameHandler')

    const moduleRef = await Test.createTestingModule({
      providers: [
        EventRegistryService,
        { provide: TypedEventService, useValue: typedEventService },
        { provide: CharacterCreationRequestedHandler, useValue: creationHandler },
        { provide: CharacterUpdateRequestedHandler, useValue: updateHandler },
        { provide: CharacterFindByChannelIdRequestedHandler, useValue: findByChannelIdHandler },
        { provide: CharacterFindByIdRequestedHandler, useValue: findByIdHandler },
        { provide: CharacterFindByNameRequestedHandler, useValue: findByNameHandler }
      ]
    }).compile()

    service = moduleRef.get(EventRegistryService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onModuleInit', () => {
    it('全ハンドラを登録し、各イベント名で typedEventService.on が呼ばれる', async () => {
      // Act
      await service.onModuleInit()

      // Assert: 5 ハンドラ分の on 登録
      expect(typedEventService.on).toHaveBeenCalledTimes(5)
      expect(typedEventService.on).toHaveBeenCalledWith('character.creation.requested', expect.any(Function))
      expect(typedEventService.on).toHaveBeenCalledWith('character.update.requested', expect.any(Function))
      expect(typedEventService.on).toHaveBeenCalledWith('character.findByChannelId.requested', expect.any(Function))
      expect(typedEventService.on).toHaveBeenCalledWith('character.findById.requested', expect.any(Function))
      expect(typedEventService.on).toHaveBeenCalledWith('character.findByName.requested', expect.any(Function))
    })

    it('各ハンドラに setTypedEventService が呼ばれ、handlers マップに登録される', async () => {
      // Act
      await service.onModuleInit()

      // Assert: setTypedEventService 呼出 + handlers 登録
      expect(creationHandler.setTypedEventService).toHaveBeenCalledWith(typedEventService)
      expect(service.getRegisteredEventNames()).toHaveLength(5)
      expect(service.getHandler('character.creation.requested')).toBe(creationHandler)
    })

    it('登録時に重複や検証 throw が起きても内部 try/catch で握り、残りの登録を継続する', async () => {
      // Arrange: 1 ハンドラだけ無効なイベント名を返させ registerHandler を throw させる
      findByIdHandler.getEventName.mockReturnValue('invalid')

      // Act: throw が onModuleInit の外に漏れないこと
      await expect(service.onModuleInit()).resolves.toBeUndefined()

      // Assert: 失敗した 1 件を除く 4 件が登録される
      expect(service.getRegisteredEventNames()).toHaveLength(4)
      expect(service.getHandler('character.findById.requested')).toBeUndefined()
    })
  })

  describe('registerHandler', () => {
    it('同名ハンドラを2回登録すると throw する', async () => {
      // Arrange
      const handler = createHandlerStub('character.creation.requested')
      await (service as any).registerHandler(handler)

      // Act & Assert
      await expect((service as any).registerHandler(handler)).rejects.toThrow(
        'Event handler already registered for: character.creation.requested'
      )
    })

    it('setTypedEventService 呼出・handlers 登録・stats 初期化を行う', async () => {
      // Arrange
      const handler = createHandlerStub('character.creation.requested')

      // Act
      await (service as any).registerHandler(handler)

      // Assert
      expect(handler.setTypedEventService).toHaveBeenCalledWith(typedEventService)
      expect(service.getHandler('character.creation.requested')).toBe(handler)
      expect(service.getEventStatistics('character.creation.requested')).toEqual({
        totalExecutions: 0,
        successCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
        lastExecuted: null,
        lastError: null
      })
    })
  })

  describe('validateHandler', () => {
    it('getEventName が関数でない場合は throw する', async () => {
      // Arrange
      const handler = createHandlerStub('character.creation.requested')
      ;(handler as any).getEventName = 'not-a-function'

      // Act & Assert
      await expect((service as any).validateHandler(handler, 'character.creation.requested')).rejects.toThrow(
        'missing getEventName() method'
      )
    })

    it('handle が関数でない場合は throw する', async () => {
      // Arrange
      const handler = createHandlerStub('character.creation.requested')
      ;(handler as any).handle = undefined

      // Act & Assert
      await expect((service as any).validateHandler(handler, 'character.creation.requested')).rejects.toThrow(
        'missing handle() method'
      )
    })

    it('getEventName と登録キーが不一致の場合は throw する', async () => {
      // Arrange
      const handler = createHandlerStub('character.creation.requested')

      // Act & Assert
      await expect((service as any).validateHandler(handler, 'character.update.requested')).rejects.toThrow(
        'Handler event name mismatch: expected character.update.requested, got character.creation.requested'
      )
    })

    it('イベント名形式が不正な場合は throw する', async () => {
      // Arrange
      const handler = createHandlerStub('invalid')

      // Act & Assert
      await expect((service as any).validateHandler(handler, 'invalid')).rejects.toThrow(
        'Invalid event name format: invalid'
      )
    })
  })

  describe('isValidEventName', () => {
    it.each([
      ['a.b.c', true],
      ['character.creation.requested', true],
      ['my-domain.find-by-id.requested', true],
      ['Character.Creation.Requested', true],
      ['foo', false],
      ['a.b', false],
      ['1domain.action.type', false],
      ['domain..type', false],
      ['domain.action.', false]
    ])('"%s" の判定は %s', (eventName, expected) => {
      // Act
      const result = (service as any).isValidEventName(eventName)

      // Assert
      expect(result).toBe(expected)
    })
  })

  describe('executeHandler', () => {
    it('ハンドラが存在しない場合は error ログを出して return する（execute は呼ばれない）', async () => {
      // Act
      await (service as any).executeHandler('character.unknown.requested', {})

      // Assert
      expect(creationHandler.execute).not.toHaveBeenCalled()
    })

    it('成功時は handler.execute を event/context 付きで呼び success stats を加算する', async () => {
      // Arrange
      await (service as any).registerHandler(creationHandler)
      const event = { correlationId: 'corr-1', source: 'discord' }

      // Act
      await (service as any).executeHandler('character.creation.requested', event)

      // Assert: execute 呼出と context 内容
      expect(creationHandler.execute).toHaveBeenCalledTimes(1)
      const [passedEvent, context] = creationHandler.execute.mock.calls[0]
      expect(passedEvent).toBe(event)
      expect(context).toMatchObject({
        correlationId: 'corr-1',
        source: 'discord',
        handlerName: 'CreationHandler',
        eventName: 'character.creation.requested'
      })

      // Assert: success stats
      const stats = service.getEventStatistics('character.creation.requested') as any
      expect(stats.totalExecutions).toBe(1)
      expect(stats.successCount).toBe(1)
      expect(stats.errorCount).toBe(0)
    })

    it('correlationId/source が無いイベントは生成値と unknown で補完する', async () => {
      // Arrange
      await (service as any).registerHandler(creationHandler)

      // Act
      await (service as any).executeHandler('character.creation.requested', {})

      // Assert
      const [, context] = creationHandler.execute.mock.calls[0]
      expect(context.correlationId).toMatch(/^evt_/)
      expect(context.source).toBe('unknown')
    })

    it('ハンドラ実行で例外が起きると error stats を加算し再スローする', async () => {
      // Arrange
      await (service as any).registerHandler(creationHandler)
      creationHandler.execute.mockRejectedValue(new Error('boom'))

      // Act & Assert: 再スロー
      await expect((service as any).executeHandler('character.creation.requested', {})).rejects.toThrow('boom')

      // Assert: error stats
      const stats = service.getEventStatistics('character.creation.requested') as any
      expect(stats.totalExecutions).toBe(1)
      expect(stats.errorCount).toBe(1)
      expect(stats.successCount).toBe(0)
      expect(stats.lastError).toMatchObject({ message: 'boom', name: 'Error' })
    })

    it('typedEventService.on に登録されたコールバック経由でも executeHandler が動く', async () => {
      // Arrange
      await service.onModuleInit()
      const onCall = typedEventService.on.mock.calls.find(([name]) => name === 'character.creation.requested')!
      const callback = onCall[1] as (event: any) => Promise<void>

      // Act
      await callback({ source: 'via-on' })

      // Assert
      expect(creationHandler.execute).toHaveBeenCalledTimes(1)
      const [, context] = creationHandler.execute.mock.calls[0]
      expect(context.source).toBe('via-on')
    })
  })

  describe('updateSuccessStats', () => {
    it('初回は averageExecutionTime に duration をそのまま設定する', () => {
      // Arrange
      const stats = {
        totalExecutions: 0,
        successCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
        lastExecuted: null,
        lastError: null
      }

      // Act
      ;(service as any).updateSuccessStats(stats, 100)

      // Assert
      expect(stats.totalExecutions).toBe(1)
      expect(stats.successCount).toBe(1)
      expect(stats.averageExecutionTime).toBe(100)
      expect(stats.lastExecuted).toBeInstanceOf(Date)
    })

    it('2回目以降は移動平均 (avg*0.8 + duration*0.2) で更新する', () => {
      // Arrange
      const stats = {
        totalExecutions: 1,
        successCount: 1,
        errorCount: 0,
        averageExecutionTime: 100,
        lastExecuted: new Date(),
        lastError: null
      }

      // Act
      ;(service as any).updateSuccessStats(stats, 200)

      // Assert: 100*0.8 + 200*0.2 = 120
      expect(stats.averageExecutionTime).toBe(120)
      expect(stats.totalExecutions).toBe(2)
      expect(stats.successCount).toBe(2)
    })
  })

  describe('updateErrorStats', () => {
    it('errorCount を加算し lastError を記録する', () => {
      // Arrange
      const stats = {
        totalExecutions: 0,
        successCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
        lastExecuted: null,
        lastError: null
      }
      const error = new Error('failed')

      // Act
      ;(service as any).updateErrorStats(stats, error, 50)

      // Assert
      expect(stats.totalExecutions).toBe(1)
      expect(stats.errorCount).toBe(1)
      expect(stats.successCount).toBe(0)
      expect(stats.lastError).toMatchObject({ message: 'failed', name: 'Error' })
      expect(stats.lastExecuted).toBeInstanceOf(Date)
    })
  })

  describe('getAllHandlers', () => {
    it('登録済みハンドラのコピー Map を返す（内部 Map とは別インスタンス）', async () => {
      // Arrange
      await (service as any).registerHandler(creationHandler)

      // Act
      const all = service.getAllHandlers()
      all.delete('character.creation.requested')

      // Assert: コピーを変更しても内部状態は壊れない
      expect(service.getHandler('character.creation.requested')).toBe(creationHandler)
    })
  })

  describe('getRegisteredEventNames', () => {
    it('登録済みイベント名をソートして返す', async () => {
      // Arrange: あえて登録順を非ソートにする
      await (service as any).registerHandler(updateHandler)
      await (service as any).registerHandler(creationHandler)

      // Act
      const names = service.getRegisteredEventNames()

      // Assert
      expect(names).toEqual(['character.creation.requested', 'character.update.requested'])
    })
  })

  describe('getEventStatistics', () => {
    it('イベント名を指定するとその統計を返す', async () => {
      // Arrange
      await (service as any).registerHandler(creationHandler)

      // Act
      const stats = service.getEventStatistics('character.creation.requested')

      // Assert
      expect(stats).toMatchObject({ totalExecutions: 0, successCount: 0, errorCount: 0 })
    })

    it('未登録イベント名を指定すると undefined を返す', () => {
      expect(service.getEventStatistics('character.unknown.requested')).toBeUndefined()
    })

    it('引数なしの場合は全統計のコピー Map を返す', async () => {
      // Arrange
      await (service as any).registerHandler(creationHandler)

      // Act
      const all = service.getEventStatistics() as Map<string, unknown>

      // Assert
      expect(all).toBeInstanceOf(Map)
      expect(all.has('character.creation.requested')).toBe(true)
    })
  })

  describe('getHealthReport', () => {
    it('実行が 0 件の場合 errorRate は 0 で healthy を返す', () => {
      // Act
      const report = service.getHealthReport()

      // Assert
      expect(report.totalExecutions).toBe(0)
      expect(report.errorRate).toBe(0)
      expect(report.healthStatus).toBe('healthy')
    })

    it('errorRate < 0.05 は healthy', async () => {
      // Arrange: 成功 100 / エラー 0
      await (service as any).registerHandler(creationHandler)
      const stats = service.getEventStatistics('character.creation.requested') as any
      stats.totalExecutions = 100
      stats.errorCount = 0

      // Act & Assert
      expect(service.getHealthReport().healthStatus).toBe('healthy')
    })

    it('0.05 <= errorRate < 0.15 は warning', async () => {
      // Arrange: 100 実行中 10 エラー = 0.1
      await (service as any).registerHandler(creationHandler)
      const stats = service.getEventStatistics('character.creation.requested') as any
      stats.totalExecutions = 100
      stats.errorCount = 10

      // Act
      const report = service.getHealthReport()

      // Assert
      expect(report.errorRate).toBeCloseTo(0.1)
      expect(report.healthStatus).toBe('warning')
    })

    it('errorRate >= 0.15 は critical', async () => {
      // Arrange: 100 実行中 20 エラー = 0.2
      await (service as any).registerHandler(creationHandler)
      const stats = service.getEventStatistics('character.creation.requested') as any
      stats.totalExecutions = 100
      stats.errorCount = 20

      // Act & Assert
      expect(service.getHealthReport().healthStatus).toBe('critical')
    })
  })

  describe('generateCorrelationId', () => {
    it('evt_ プレフィックス付きの形式で生成する', () => {
      // Act
      const id = (service as any).generateCorrelationId()

      // Assert
      expect(id).toMatch(/^evt_\d+_[a-z0-9]+$/)
    })

    it('呼び出しごとに異なる値を返す', () => {
      const a = (service as any).generateCorrelationId()
      const b = (service as any).generateCorrelationId()
      expect(a).not.toBe(b)
    })
  })
})
