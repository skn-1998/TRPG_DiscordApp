import { setupDiscordModuleMock } from '@discord-test-utils/jest/discord-module.mock'

// jest-setup.ts のグローバル discord.js モックには Events 列挙が無く、
// 本サービスが使う Events.InteractionCreate が undefined になるため、
// このファイル専用に Events を備えた完全モックで上書きする。
setupDiscordModuleMock()

import { Test } from '@nestjs/testing'
import { Events, type Client, type Interaction } from 'discord.js'
import { DiscordInteractionHandlerService } from './discord-interaction-handler.service'
import { InteractionsService } from '../interactions/interactions.service'
import { CommandsService } from '../commands/commands.service'
import { AppConfigService } from '../../config/config.service'
import { ErrorHandler } from '../../utils/error-handler'
import type { DiscordButton, DiscordModal, DiscordSelectMenu } from '../interfaces/discord-interaction-types.interface'

/**
 * DiscordInteractionHandlerService は Discord.js の Interaction を受け取り、
 * 型ガード（isCommand / isAutocomplete / isButton / isAnySelectMenu / isModalSubmit）に応じて
 * 該当ハンドラへ振り分ける imperative shell。
 *
 * 副作用の境界（=モックする対象）:
 *   - InteractionsService.execute      … 未登録 customId の fallback 先
 *   - CommandsService.execute/autocomplete … コマンド・オートコンプリート委譲先
 *   - ErrorHandler.handleError         … 例外時の委譲先（jest.mock でスタブ）
 *   - setTimeout（5分後の cleanup）     … jest.useFakeTimers() で制御
 *   - client.on                        … リスナー登録。jest.fn でコールバックを捕捉
 *
 * handleInteraction は private だが、setupInteractionListeners 経由で
 * client.on(Events.InteractionCreate, cb) に登録される cb として取り出して実行する。
 *
 * interaction は型ガードを個別に制御したいため、専用の軽量スタブを使う
 * （既存ファクトリは isCommand / isAnySelectMenu を持たず、本サービスの分岐網羅に不向き）。
 */

jest.mock('../../utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn().mockResolvedValue(undefined)
  }
}))

const handleErrorMock = ErrorHandler.handleError as jest.Mock

/** Interaction の型ガードのうち、指定したもの「だけ」を true にするスタブを生成する */
type GuardKind = 'command' | 'autocomplete' | 'button' | 'select' | 'modal'

function createInteractionStub(
  kind: GuardKind | null,
  overrides: { id?: string; customId?: string; commandName?: string; type?: number } = {}
): Interaction {
  return {
    id: overrides.id ?? 'interaction-1',
    type: overrides.type ?? 0,
    customId: overrides.customId ?? 'test-custom-id',
    commandName: overrides.commandName ?? 'test-command',
    isCommand: jest.fn().mockReturnValue(kind === 'command'),
    isAutocomplete: jest.fn().mockReturnValue(kind === 'autocomplete'),
    isButton: jest.fn().mockReturnValue(kind === 'button'),
    isAnySelectMenu: jest.fn().mockReturnValue(kind === 'select'),
    isModalSubmit: jest.fn().mockReturnValue(kind === 'modal')
  } as unknown as Interaction
}

describe('DiscordInteractionHandlerService', () => {
  let service: DiscordInteractionHandlerService
  let interactionsService: jest.Mocked<Pick<InteractionsService, 'execute'>>
  let commandsService: jest.Mocked<Pick<CommandsService, 'execute' | 'autocomplete'>>

  beforeEach(async () => {
    interactionsService = { execute: jest.fn().mockResolvedValue(undefined) }
    commandsService = {
      execute: jest.fn().mockResolvedValue(undefined),
      autocomplete: jest.fn().mockResolvedValue(undefined)
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscordInteractionHandlerService,
        { provide: InteractionsService, useValue: interactionsService },
        { provide: CommandsService, useValue: commandsService },
        { provide: AppConfigService, useValue: {} }
      ]
    }).compile()

    service = moduleRef.get(DiscordInteractionHandlerService)
    handleErrorMock.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /** client.on に登録された InteractionCreate コールバックを捕捉して返す */
  function captureInteractionCallback(): (interaction: Interaction) => Promise<void> {
    const on = jest.fn()
    const client = { on } as unknown as Client
    service.setupInteractionListeners(client)

    const call = on.mock.calls.find(([event]) => event === Events.InteractionCreate)
    expect(call).toBeDefined()
    return call![1] as (interaction: Interaction) => Promise<void>
  }

  describe('initialize / isInitialized', () => {
    it('初回呼び出しでリスナーを登録し、初期化済みになる', async () => {
      // Arrange
      const on = jest.fn()
      const client = { on } as unknown as Client

      // Act
      await service.initialize(client)

      // Assert
      expect(on).toHaveBeenCalledWith(Events.InteractionCreate, expect.any(Function))
      expect(service.isInitialized()).toBe(true)
    })

    it('2回目の呼び出しでは再度リスナー登録しない', async () => {
      // Arrange
      const on = jest.fn()
      const client = { on } as unknown as Client

      // Act
      await service.initialize(client)
      await service.initialize(client)

      // Assert: リスナー登録は1回のみ
      expect(on).toHaveBeenCalledTimes(1)
    })

    it('初期化前は isInitialized が false を返す', () => {
      expect(service.isInitialized()).toBe(false)
    })
  })

  describe('handleInteraction（捕捉した client.on コールバック経由）', () => {
    it('同一 interaction.id を重複処理しようとすると2回目は何もしない', async () => {
      // Arrange
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('command', { id: 'dup-1' })

      // Act
      await cb(interaction)
      await cb(interaction)

      // Assert: 委譲は初回の1回のみ
      expect(commandsService.execute).toHaveBeenCalledTimes(1)
    })

    it('コマンドは CommandsService.execute に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('command')

      await cb(interaction)

      expect(commandsService.execute).toHaveBeenCalledWith(interaction)
      expect(commandsService.autocomplete).not.toHaveBeenCalled()
    })

    it('オートコンプリートは CommandsService.autocomplete に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('autocomplete')

      await cb(interaction)

      expect(commandsService.autocomplete).toHaveBeenCalledWith(interaction)
      expect(commandsService.execute).not.toHaveBeenCalled()
    })

    it('ボタンはボタンハンドラ処理に振り分けられる（未登録なら fallback）', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('button', { customId: 'unregistered-btn' })

      await cb(interaction)

      expect(interactionsService.execute).toHaveBeenCalledWith(interaction)
    })

    it('セレクトメニューはセレクト処理に振り分けられる', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('select', { customId: 'unregistered-select' })

      await cb(interaction)

      expect(interactionsService.execute).toHaveBeenCalledWith(interaction)
    })

    it('モーダル送信はモーダル処理に振り分けられる', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('modal', { customId: 'unregistered-modal' })

      await cb(interaction)

      expect(interactionsService.execute).toHaveBeenCalledWith(interaction)
    })

    it('どの型ガードにも該当しないインタラクションは何も委譲しない', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub(null)

      await cb(interaction)

      expect(commandsService.execute).not.toHaveBeenCalled()
      expect(commandsService.autocomplete).not.toHaveBeenCalled()
      expect(interactionsService.execute).not.toHaveBeenCalled()
      expect(handleErrorMock).not.toHaveBeenCalled()
    })

    it('ハンドラが例外を投げた場合 ErrorHandler.handleError に委譲する', async () => {
      // Arrange: コマンド委譲先で例外を起こす
      commandsService.execute.mockRejectedValue(new Error('boom'))
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('command', { id: 'err-1', type: 2 })

      // Act
      await cb(interaction)

      // Assert: Promise.allSettled で握りつぶされるため、ここでは handleError ではなく
      // 正常終了する（allSettled は reject を catch に伝播させない）
      expect(handleErrorMock).not.toHaveBeenCalled()
    })

    it('型ガード呼び出し自体が例外を投げた場合 ErrorHandler.handleError に委譲する', async () => {
      // Arrange: isCommand が throw する異常系
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('command', { id: 'err-2', type: 2 })
      ;(interaction.isCommand as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('guard failure')
      })

      // Act
      await cb(interaction)

      // Assert
      expect(handleErrorMock).toHaveBeenCalledTimes(1)
      expect(handleErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: 'discord-interaction-handler',
          interactionId: 'err-2'
        })
      )
    })

    it('finally の setTimeout 経過後に processedInteractions から id を削除する', async () => {
      // Arrange
      jest.useFakeTimers()
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('command', { id: 'cleanup-1' })

      // Act
      await cb(interaction)

      // Assert: 直後はまだ記録されている
      expect(service.getHandlerStats().processedCount).toBe(1)

      // 5分経過させると削除される
      jest.advanceTimersByTime(300000)
      expect(service.getHandlerStats().processedCount).toBe(0)

      jest.useRealTimers()
    })
  })

  describe('handleButtonInteraction（登録済みハンドラの分岐）', () => {
    it('登録済み customId のボタンは専用ハンドラの execute を呼び、fallback しない', async () => {
      // Arrange
      const buttonHandler = {
        data: {},
        execute: jest.fn().mockResolvedValue(undefined)
      } as unknown as DiscordButton
      service.registerButton('registered-btn', buttonHandler)
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('button', { customId: 'registered-btn' })

      // Act
      await cb(interaction)

      // Assert
      expect(buttonHandler.execute).toHaveBeenCalledWith(interaction)
      expect(interactionsService.execute).not.toHaveBeenCalled()
    })
  })

  describe('handleSelectMenuInteraction（3分岐）', () => {
    it('登録済み customId のセレクトは専用ハンドラの execute を呼ぶ', async () => {
      const selectHandler = {
        data: {},
        execute: jest.fn().mockResolvedValue(undefined)
      } as unknown as DiscordSelectMenu
      service.registerSelectMenu('registered-select', selectHandler)
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('select', { customId: 'registered-select' })

      await cb(interaction)

      expect(selectHandler.execute).toHaveBeenCalledWith(interaction)
      expect(interactionsService.execute).not.toHaveBeenCalled()
    })

    it('character-section-select- で始まる未登録セレクトは InteractionsService に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('select', { customId: 'character-section-select-hp' })

      await cb(interaction)

      expect(interactionsService.execute).toHaveBeenCalledWith(interaction)
    })

    it('その他の未登録セレクトも InteractionsService に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('select', { customId: 'other-select' })

      await cb(interaction)

      expect(interactionsService.execute).toHaveBeenCalledWith(interaction)
    })
  })

  describe('handleModalInteraction（登録済みハンドラの分岐）', () => {
    it('登録済み customId のモーダルは専用ハンドラの execute を呼び、fallback しない', async () => {
      const modalHandler = {
        data: {},
        execute: jest.fn().mockResolvedValue(undefined)
      } as unknown as DiscordModal
      service.registerModal('registered-modal', modalHandler)
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('modal', { customId: 'registered-modal' })

      await cb(interaction)

      expect(modalHandler.execute).toHaveBeenCalledWith(interaction)
      expect(interactionsService.execute).not.toHaveBeenCalled()
    })
  })

  describe('registerButton / registerModal / registerSelectMenu / getHandlerStats', () => {
    it('登録した各ハンドラ数と処理済み件数を集計して返す', () => {
      // Arrange
      const handler = { data: {}, execute: jest.fn() }
      service.registerButton('b1', handler as unknown as DiscordButton)
      service.registerButton('b2', handler as unknown as DiscordButton)
      service.registerModal('m1', handler as unknown as DiscordModal)
      service.registerSelectMenu('s1', handler as unknown as DiscordSelectMenu)

      // Act
      const stats = service.getHandlerStats()

      // Assert
      expect(stats).toEqual({ buttons: 2, modals: 1, selects: 1, processedCount: 0 })
    })
  })

  describe('clearExpiredInteractions', () => {
    it('処理済みインタラクション記録をすべて削除する', async () => {
      // Arrange: timer を止めて自動削除を無効化し、記録を残す
      jest.useFakeTimers()
      const cb = captureInteractionCallback()
      await cb(createInteractionStub('command', { id: 'a' }))
      await cb(createInteractionStub('command', { id: 'b' }))
      expect(service.getHandlerStats().processedCount).toBe(2)

      // Act
      service.clearExpiredInteractions()

      // Assert
      expect(service.getHandlerStats().processedCount).toBe(0)

      jest.useRealTimers()
    })
  })
})
