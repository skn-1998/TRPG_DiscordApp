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
import { ErrorHandler } from '../../core/http/error-handler'

/**
 * DiscordInteractionHandlerService は Discord.js の Interaction を受け取り、
 * 型ガード（isCommand / isAutocomplete / isButton / isAnySelectMenu / isModalSubmit）に応じて
 * 委譲先へルーティングする imperative shell（client.on(InteractionCreate) の唯一の入口）。
 *
 * ルーティング契約（characterization）:
 *   - command      → CommandsService.execute
 *   - autocomplete → CommandsService.autocomplete
 *   - button / select / modal → InteractionsService.execute（Registry へ一本化）
 *   - 委譲先が throw してもリスナーは落ちない（Promise.allSettled / ErrorHandler で吸収）
 *
 * 副作用の境界（=モックする対象）:
 *   - InteractionsService.execute      … component 系（button/select/modal）の委譲先
 *   - CommandsService.execute/autocomplete … コマンド・オートコンプリート委譲先
 *   - ErrorHandler.handleError         … 同期例外時の委譲先（jest.mock でスタブ）
 *   - client.on                        … リスナー登録。jest.fn でコールバックを捕捉
 *
 * handleInteraction は private だが、setupInteractionListeners 経由で
 * client.on(Events.InteractionCreate, cb) に登録される cb として取り出して実行する。
 *
 * interaction は型ガードを個別に制御したいため、専用の軽量スタブを使う
 * （既存ファクトリは isCommand / isAnySelectMenu を持たず、本サービスの分岐網羅に不向き）。
 */

jest.mock('../../core/http/error-handler', () => ({
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
        { provide: CommandsService, useValue: commandsService }
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

  describe('handleInteraction（捕捉した client.on コールバック経由のルーティング）', () => {
    it('コマンドは CommandsService.execute に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('command')

      await cb(interaction)

      expect(commandsService.execute).toHaveBeenCalledWith(interaction)
      expect(commandsService.autocomplete).not.toHaveBeenCalled()
      expect(interactionsService.execute).not.toHaveBeenCalled()
    })

    it('オートコンプリートは CommandsService.autocomplete に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('autocomplete')

      await cb(interaction)

      expect(commandsService.autocomplete).toHaveBeenCalledWith(interaction)
      expect(commandsService.execute).not.toHaveBeenCalled()
      expect(interactionsService.execute).not.toHaveBeenCalled()
    })

    it('ボタンは InteractionsService.execute に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('button', { customId: 'any-btn' })

      await cb(interaction)

      expect(interactionsService.execute).toHaveBeenCalledWith(interaction)
      expect(commandsService.execute).not.toHaveBeenCalled()
    })

    it('セレクトメニューは InteractionsService.execute に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('select', { customId: 'any-select' })

      await cb(interaction)

      expect(interactionsService.execute).toHaveBeenCalledWith(interaction)
      expect(commandsService.execute).not.toHaveBeenCalled()
    })

    // 旧 character-section-select- 特例分岐は撤去済み。同 customId も統一ルーティングで
    // InteractionsService へ委譲されること（routing 不変）を regression guard として固定する。
    it('character-section-select- で始まるセレクトも統一ルーティングで InteractionsService に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('select', { customId: 'character-section-select-hp' })

      await cb(interaction)

      expect(interactionsService.execute).toHaveBeenCalledWith(interaction)
    })

    it('モーダル送信は InteractionsService.execute に委譲する', async () => {
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('modal', { customId: 'any-modal' })

      await cb(interaction)

      expect(interactionsService.execute).toHaveBeenCalledWith(interaction)
      expect(commandsService.execute).not.toHaveBeenCalled()
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
  })

  describe('handleInteraction（例外時もリスナーが落ちない）', () => {
    it('コマンド委譲先が reject しても cb は正常終了する（Promise.allSettled が吸収）', async () => {
      // Arrange: コマンド委譲先で例外を起こす
      commandsService.execute.mockRejectedValue(new Error('boom'))
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('command', { id: 'err-1', type: 2 })

      // Act & Assert: cb 自体は reject しない（リスナーが落ちない）
      await expect(cb(interaction)).resolves.toBeUndefined()

      // allSettled は reject を catch に伝播させないため handleError は呼ばれない
      expect(handleErrorMock).not.toHaveBeenCalled()
    })

    it('component 委譲先（InteractionsService.execute）が reject しても cb は正常終了する', async () => {
      // Arrange
      interactionsService.execute.mockRejectedValue(new Error('component boom'))
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('button', { id: 'err-btn', customId: 'boom-btn' })

      // Act & Assert
      await expect(cb(interaction)).resolves.toBeUndefined()
      expect(handleErrorMock).not.toHaveBeenCalled()
    })

    it('型ガード呼び出し自体が例外を投げた場合 ErrorHandler.handleError に委譲し、cb は正常終了する', async () => {
      // Arrange: isCommand が throw する異常系
      const cb = captureInteractionCallback()
      const interaction = createInteractionStub('command', { id: 'err-2', type: 2 })
      ;(interaction.isCommand as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('guard failure')
      })

      // Act & Assert
      await expect(cb(interaction)).resolves.toBeUndefined()
      expect(handleErrorMock).toHaveBeenCalledTimes(1)
      expect(handleErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: 'discord-interaction-handler',
          interactionId: 'err-2'
        })
      )
    })
  })
})
