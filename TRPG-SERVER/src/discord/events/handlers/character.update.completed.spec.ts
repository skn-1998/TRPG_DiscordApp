// CharacterUpdateCompletedHandler は character.update.completed を処理し、
// キャラクター更新完了時の Discord UI 更新を行う（EventHandler 基底を継承）。
// 検証対象:
//   - onModuleInit(): setTypedEventService + typedEventService.on(getEventName(), ...) による自己購読登録
//   - getEventName() / getMaxRetries() の戻り値
//   - handle(): updateDiscordUI を呼び、失敗時は再スロー
//   - updateDiscordUI(private/handle 経由): discordChannelId / discordThreadId / updatedFields による
//     呼び分けと、各 try/catch の個別失敗握り潰し（embed・thread・status はいずれも致命的でない）
//   - shouldNotifyUpdate(private): importantFields 判定（型アサーション経由）
//   - isRetryableError / getMaxRetries
// 副作用境界は CharacterUIService・ThreadOrchestratorService・TypedEventService の 3 つ。
// 基底由来の this.logger は内部で new Logger されるため追加注入不要。

import { Test } from '@nestjs/testing'
import { CharacterUIService } from 'discord/features/characterEdit/services/character-ui.service'
import { ThreadOrchestratorService } from 'discord/features/characterThread/services/thread-orchestrator.service'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { CharacterUpdateCompletedEvent } from 'events/contracts/unified-event-contracts'
import { CharacterUpdateCompletedHandler } from './character.update.completed'

describe('CharacterUpdateCompletedHandler', () => {
  let handler: CharacterUpdateCompletedHandler
  let characterUIService: jest.Mocked<Pick<CharacterUIService, 'updateCharacterEmbed'>>
  let threadOrchestratorService: jest.Mocked<Pick<ThreadOrchestratorService, 'updateCharacterThreadDisplay'>>
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'on'>>

  // 最小スタブ。character は as any で Character へ通す。
  // E-4a: 契約は {channelId, character, source, timestamp}（実 emit と一致）。契約外 updatedFields は撤去済み。
  function buildEvent(characterOverrides: Record<string, unknown> = {}): CharacterUpdateCompletedEvent {
    return {
      channelId: 'ch-1',
      character: {
        characterName: 'アリス',
        characterId: 'char-1',
        discordChannelId: 'ch-1',
        discordThreadId: 'th-1',
        discordUserId: 'user-1',
        ...characterOverrides
      },
      source: 'test',
      timestamp: new Date()
    } as unknown as CharacterUpdateCompletedEvent
  }

  beforeEach(async () => {
    characterUIService = {
      updateCharacterEmbed: jest.fn().mockResolvedValue(undefined)
    }
    threadOrchestratorService = {
      updateCharacterThreadDisplay: jest.fn().mockResolvedValue(undefined)
    }
    typedEventService = {
      on: jest.fn()
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterUpdateCompletedHandler,
        { provide: CharacterUIService, useValue: characterUIService },
        { provide: ThreadOrchestratorService, useValue: threadOrchestratorService },
        { provide: TypedEventService, useValue: typedEventService }
      ]
    }).compile()

    handler = moduleRef.get(CharacterUpdateCompletedHandler)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onModuleInit', () => {
    it('setTypedEventService を呼び、自身の execute をイベント名で自己購読する', () => {
      // Arrange: execute を spy して購読ハンドラーが execute を呼ぶことを確認する
      const executeSpy = jest
        .spyOn(handler as unknown as { execute(e: unknown): Promise<void> }, 'execute')
        .mockResolvedValue(undefined)

      // Act
      handler.onModuleInit()

      // Assert: getEventName() でリスナー登録される
      expect(typedEventService.on).toHaveBeenCalledTimes(1)
      expect(typedEventService.on).toHaveBeenCalledWith('character.update.completed', expect.any(Function))

      // 登録された購読ハンドラーは execute へ委譲する
      const registeredHandler = typedEventService.on.mock.calls[0][1] as (e: unknown) => void
      const event = buildEvent()
      registeredHandler(event)
      expect(executeSpy).toHaveBeenCalledWith(event)
    })

    it('setTypedEventService により基底へ TypedEventService が設定される', () => {
      // Act
      handler.onModuleInit()

      // Assert: 基底の typedEventService フィールドに注入インスタンスが設定される
      expect((handler as unknown as { typedEventService?: unknown }).typedEventService).toBe(typedEventService)
    })
  })

  describe('getEventName', () => {
    it('character.update.completed を返す', () => {
      // Act & Assert
      expect(handler.getEventName()).toBe('character.update.completed')
    })
  })

  describe('getMaxRetries', () => {
    it('最大リトライ回数は 2 を返す', () => {
      // Act & Assert: protected メソッドだが現挙動として 2 を保証する
      expect((handler as unknown as { getMaxRetries(): number }).getMaxRetries()).toBe(2)
    })
  })

  describe('isRetryableError', () => {
    const callIsRetryable = (error: Error): boolean =>
      (handler as unknown as { isRetryableError(e: Error): boolean }).isRetryableError(error)

    it.each(['Discord', 'API'])('メッセージに "%s" を含むエラーはリトライ可能と判定する', (keyword) => {
      // Act & Assert
      expect(callIsRetryable(new Error(`something ${keyword} failed`))).toBe(true)
    })

    it('該当キーワードを含まない一般エラーは super 委譲で false になる', () => {
      // Act & Assert
      expect(callIsRetryable(new Error('totally unrelated message'))).toBe(false)
    })

    it('super が拾うキーワード(TimeoutError)はリトライ可能と判定する', () => {
      // Act & Assert: 自前判定で拾わず super.isRetryableError へ委譲されることを確認
      expect(callIsRetryable(new Error('TimeoutError occurred'))).toBe(true)
    })
  })

  describe('handle', () => {
    it('channelId / threadId ありで embed とスレッド表示を更新し、正常完了する', async () => {
      // Arrange
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert
      expect(characterUIService.updateCharacterEmbed).toHaveBeenCalledWith('ch-1', event.character)
      expect(threadOrchestratorService.updateCharacterThreadDisplay).toHaveBeenCalledWith(event.character)
    })

    it('discordChannelId 無しのときは embed 更新を呼ばない', async () => {
      // Arrange: channelId 無し、threadId のみ
      const event = buildEvent({ discordChannelId: undefined })

      // Act
      await handler.handle(event)

      // Assert
      expect(characterUIService.updateCharacterEmbed).not.toHaveBeenCalled()
      // threadId はあるのでスレッド更新は呼ばれる
      expect(threadOrchestratorService.updateCharacterThreadDisplay).toHaveBeenCalledWith(event.character)
    })

    it('discordThreadId 無しのときはスレッド表示更新を呼ばない', async () => {
      // Arrange
      const event = buildEvent({ discordThreadId: undefined })

      // Act
      await handler.handle(event)

      // Assert
      expect(threadOrchestratorService.updateCharacterThreadDisplay).not.toHaveBeenCalled()
      // channelId はあるので embed 更新は呼ばれる
      expect(characterUIService.updateCharacterEmbed).toHaveBeenCalledWith('ch-1', event.character)
    })

    it('embed 更新が失敗しても握り潰して後続処理を続行する', async () => {
      // Arrange
      characterUIService.updateCharacterEmbed.mockRejectedValue(new Error('embed boom'))
      const event = buildEvent()

      // Act & Assert: 再スローされない
      await expect(handler.handle(event)).resolves.toBeUndefined()
      // 後続のスレッド更新は実行される
      expect(threadOrchestratorService.updateCharacterThreadDisplay).toHaveBeenCalledWith(event.character)
    })

    it('スレッド表示更新が失敗しても握り潰して正常終了する', async () => {
      // Arrange
      threadOrchestratorService.updateCharacterThreadDisplay.mockRejectedValue(new Error('thread boom'))
      const event = buildEvent()

      // Act & Assert
      await expect(handler.handle(event)).resolves.toBeUndefined()
    })

    it('updateDiscordUI が throw した場合は handle が再スローする', async () => {
      // Arrange: updateDiscordUI 内の try/catch を経由しない経路で throw させるため
      //          updateDiscordUI 自体を spy で差し替える
      const failure = new Error('update boom')
      jest
        .spyOn(handler as unknown as { updateDiscordUI(...args: unknown[]): Promise<void> }, 'updateDiscordUI')
        .mockRejectedValue(failure)
      const event = buildEvent()

      // Act & Assert
      await expect(handler.handle(event)).rejects.toBe(failure)
    })
  })

  // E-4a: 契約外 updatedFields に依存していた shouldNotifyUpdate（コメントアウト済み通知分岐の残骸）は
  // 実装ごと撤去したため、対応する describe も削除した。
})
