// DiscordThreadCreateRequestedHandler は discord.thread.create.requested を処理し、
// ThreadOrchestratorService へスレッド作成を委譲する（EventHandler 基底を継承）。
// 検証対象:
//   - onModuleInit(): setTypedEventService と自己購読（on(getEventName(), ...)）
//   - getEventName() の戻り値
//   - handle(): 正常時は handleThreadCreateRequest を1回呼ぶ
//             例外時は typedEventService 設定済みなら failed イベントを emit してから再スロー
//             typedEventService 未設定なら emit せず再スローのみ
//   - customValidation(protected): character/channelId/guildId/creatorId 欠落で対応 Error を throw
// 副作用境界は ThreadOrchestratorService と TypedEventService のみ。
// 基底由来の this.logger は内部で new Logger されるため追加注入不要。

import { Test } from '@nestjs/testing'
import { ThreadOrchestratorService } from 'discord/features/characterThread/services/thread-orchestrator.service'
import { TypedEventService } from 'src/core/events/typed-event.service'
import type { EventPayload } from 'events/contracts'
import { EventContext } from 'events/handlers/_shared/event-handler.base'
import { DiscordThreadCreateRequestedHandler } from './discord.thread.create.requested'

type ThreadCreateEvent = EventPayload<'discord.thread.create.requested'>

describe('DiscordThreadCreateRequestedHandler', () => {
  let handler: DiscordThreadCreateRequestedHandler
  let threadOrchestrator: jest.Mocked<Pick<ThreadOrchestratorService, 'handleThreadCreateRequest'>>
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'emit' | 'on'>>

  function buildEvent(overrides: Partial<ThreadCreateEvent> = {}): ThreadCreateEvent {
    return {
      character: { characterId: 'char-1' },
      channelId: 'ch-1',
      guildId: 'guild-1',
      creatorId: 'user-1',
      source: 'discord',
      timestamp: new Date(),
      ...overrides
    } as ThreadCreateEvent
  }

  const buildContext = (): EventContext => ({ correlationId: 'corr-1' }) as EventContext

  // protected メソッドへ型アサーション経由でアクセスするヘルパー
  const callCustomValidation = (event: ThreadCreateEvent): Promise<void> =>
    (
      handler as unknown as {
        customValidation(e: ThreadCreateEvent): Promise<void>
      }
    ).customValidation(event)

  beforeEach(async () => {
    threadOrchestrator = {
      handleThreadCreateRequest: jest.fn().mockResolvedValue(undefined)
    }
    typedEventService = {
      emit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscordThreadCreateRequestedHandler,
        { provide: ThreadOrchestratorService, useValue: threadOrchestrator },
        { provide: TypedEventService, useValue: typedEventService }
      ]
    }).compile()

    handler = moduleRef.get(DiscordThreadCreateRequestedHandler)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getEventName', () => {
    it('discord.thread.create.requested を返す', () => {
      // Act & Assert
      expect(handler.getEventName()).toBe('discord.thread.create.requested')
    })
  })

  describe('onModuleInit', () => {
    it('TypedEventService を設定し、イベント名で自己購読する', () => {
      // Act
      handler.onModuleInit()

      // Assert: getEventName() のイベント名で on 購読する
      expect(typedEventService.on).toHaveBeenCalledTimes(1)
      expect(typedEventService.on).toHaveBeenCalledWith('discord.thread.create.requested', expect.any(Function))
    })

    it('購読したリスナーは execute を呼び出す', () => {
      // Arrange
      const executeSpy = jest
        .spyOn(handler as unknown as { execute(e: ThreadCreateEvent): Promise<void> }, 'execute')
        .mockResolvedValue(undefined)
      handler.onModuleInit()
      const listener = typedEventService.on.mock.calls[0][1] as (e: ThreadCreateEvent) => void
      const event = buildEvent()

      // Act
      listener(event)

      // Assert
      expect(executeSpy).toHaveBeenCalledWith(event)
    })
  })

  describe('handle', () => {
    it('正常時は ThreadOrchestrator へ1回委譲する', async () => {
      // Arrange
      const event = buildEvent()

      // Act
      await handler.handle(event, buildContext())

      // Assert
      expect(threadOrchestrator.handleThreadCreateRequest).toHaveBeenCalledTimes(1)
      expect(threadOrchestrator.handleThreadCreateRequest).toHaveBeenCalledWith(event)
    })

    it('委譲が例外を投げると failed イベントを emit してから再スローする', async () => {
      // Arrange: onModuleInit で typedEventService を設定済みにする
      handler.onModuleInit()
      const failure = new Error('orchestrator boom')
      threadOrchestrator.handleThreadCreateRequest.mockRejectedValue(failure)
      const event = buildEvent()

      // Act & Assert: 同じエラーが再スローされる
      await expect(handler.handle(event, buildContext())).rejects.toBe(failure)

      // Assert: failed イベントの payload を検証（引き継ぎ項目とエラーコード）
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'discord.thread.create.failed',
        expect.objectContaining({
          character: event.character,
          channelId: 'ch-1',
          guildId: 'guild-1',
          creatorId: 'user-1',
          source: 'discord',
          correlationId: 'corr-1',
          error: expect.objectContaining({
            code: 'THREAD_CREATION_ERROR',
            message: 'orchestrator boom'
          })
        })
      )
    })

    it('Error 以外が投げられた場合は failed の message が Unknown error になる', async () => {
      // Arrange
      handler.onModuleInit()
      threadOrchestrator.handleThreadCreateRequest.mockRejectedValue('string failure')
      const event = buildEvent()

      // Act & Assert
      await expect(handler.handle(event, buildContext())).rejects.toBe('string failure')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'discord.thread.create.failed',
        expect.objectContaining({
          error: expect.objectContaining({ message: 'Unknown error' })
        })
      )
    })

    it('typedEventService 未設定なら emit せず再スローのみ行う', async () => {
      // Arrange: onModuleInit を呼ばず typedEventService 未設定のままにする
      const failure = new Error('orchestrator boom')
      threadOrchestrator.handleThreadCreateRequest.mockRejectedValue(failure)
      const event = buildEvent()

      // Act & Assert
      await expect(handler.handle(event, buildContext())).rejects.toBe(failure)
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })
  })

  describe('customValidation', () => {
    it('全項目そろっていれば解決する', async () => {
      // Act & Assert
      await expect(callCustomValidation(buildEvent())).resolves.toBeUndefined()
    })

    it('character 欠落で Error を投げる', async () => {
      // Arrange
      const event = buildEvent({ character: undefined })

      // Act & Assert
      await expect(callCustomValidation(event)).rejects.toThrow('Character is required for thread creation')
    })

    it('channelId 欠落で Error を投げる', async () => {
      const event = buildEvent({ channelId: undefined as unknown as string })

      await expect(callCustomValidation(event)).rejects.toThrow('Channel ID is required for thread creation')
    })

    it('guildId 欠落で Error を投げる', async () => {
      const event = buildEvent({ guildId: undefined as unknown as string })

      await expect(callCustomValidation(event)).rejects.toThrow('Guild ID is required for thread creation')
    })

    it('creatorId 欠落で Error を投げる', async () => {
      const event = buildEvent({ creatorId: undefined as unknown as string })

      await expect(callCustomValidation(event)).rejects.toThrow('Creator ID is required for thread creation')
    })
  })
})
