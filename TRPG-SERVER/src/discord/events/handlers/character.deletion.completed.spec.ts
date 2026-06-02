// CharacterDeletionCompletedHandler は character.deletion.completed を処理し、
// キャラクター削除完了時の Discord UI クリーンアップを行う（EventHandler 基底を継承）。
// 検証対象:
//   - getEventName() の戻り値
//   - handle(): updateDiscordUI を呼び、失敗時は再スロー
//   - updateDiscordUI(private/handle 経由): discordChannelId の有無による呼び分けと
//     各 try/catch の個別失敗握り潰し（通知・cleanup・embed はいずれも致命的でない）
//   - handleChannelCleanup: archive 失敗時の addChannelArchiveEmoji フォールバックと両失敗時 throw
//   - isRetryableError / getMaxRetries
// 副作用境界は CharacterUIService のみ。基底由来の this.logger は内部で new Logger されるため追加注入不要。

import { Test } from '@nestjs/testing'
import { CharacterUIService } from 'discord/features/characterEdit/services/character-ui.service'
import { CharacterDeletionCompletedEvent } from 'events/contracts/unified-event-contracts'
import { CharacterDeletionCompletedHandler } from './character.deletion.completed'

describe('CharacterDeletionCompletedHandler', () => {
  let handler: CharacterDeletionCompletedHandler
  let characterUIService: jest.Mocked<
    Pick<
      CharacterUIService,
      | 'sendCharacterDeletionNotification'
      | 'removeCharacterEmbeds'
      | 'updateChannelName'
      | 'archiveChannel'
      | 'addChannelArchiveEmoji'
    >
  >

  function buildEvent(
    deletedOverrides: Partial<CharacterDeletionCompletedEvent['deletedCharacterData']> = {}
  ): CharacterDeletionCompletedEvent {
    return {
      type: 'character.deletion.completed',
      characterId: 'char-1',
      deletedCharacterData: {
        characterName: 'アリス',
        discordChannelId: 'ch-1',
        discordUserId: 'user-1',
        ...deletedOverrides
      }
    } as CharacterDeletionCompletedEvent
  }

  beforeEach(async () => {
    characterUIService = {
      sendCharacterDeletionNotification: jest.fn().mockResolvedValue(undefined),
      removeCharacterEmbeds: jest.fn().mockResolvedValue(undefined),
      updateChannelName: jest.fn().mockResolvedValue(undefined),
      archiveChannel: jest.fn().mockResolvedValue(undefined),
      addChannelArchiveEmoji: jest.fn().mockResolvedValue(undefined)
    }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterDeletionCompletedHandler, { provide: CharacterUIService, useValue: characterUIService }]
    }).compile()

    handler = moduleRef.get(CharacterDeletionCompletedHandler)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getEventName', () => {
    it('character.deletion.completed を返す', () => {
      // Act & Assert
      expect(handler.getEventName()).toBe('character.deletion.completed')
    })
  })

  describe('getMaxRetries', () => {
    it('最大リトライ回数は 3 を返す', () => {
      // Act & Assert: protected メソッドだが現挙動として 3 を保証する
      expect((handler as unknown as { getMaxRetries(): number }).getMaxRetries()).toBe(3)
    })
  })

  describe('isRetryableError', () => {
    const callIsRetryable = (error: Error): boolean =>
      (handler as unknown as { isRetryableError(e: Error): boolean }).isRetryableError(error)

    it.each(['Discord', 'API', 'channel', 'permission'])(
      'メッセージに "%s" を含むエラーはリトライ可能と判定する',
      (keyword) => {
        // Act & Assert
        expect(callIsRetryable(new Error(`something ${keyword} failed`))).toBe(true)
      }
    )

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
    it('discordChannelId ありで全 UI 更新を呼び出し、正常完了する', async () => {
      // Arrange
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert: 通知 → チャンネルクリーンアップ → embed 削除
      expect(characterUIService.sendCharacterDeletionNotification).toHaveBeenCalledWith('ch-1', 'アリス', 'user-1')
      expect(characterUIService.updateChannelName).toHaveBeenCalledWith('ch-1', '🗄️-archived-アリス')
      expect(characterUIService.archiveChannel).toHaveBeenCalledWith('ch-1')
      expect(characterUIService.removeCharacterEmbeds).toHaveBeenCalledWith('ch-1')
      expect(characterUIService.addChannelArchiveEmoji).not.toHaveBeenCalled()
    })

    it('discordChannelId 無しのときは UI 更新を一切呼ばない', async () => {
      // Arrange
      const event = buildEvent({ discordChannelId: undefined })

      // Act
      await handler.handle(event)

      // Assert
      expect(characterUIService.sendCharacterDeletionNotification).not.toHaveBeenCalled()
      expect(characterUIService.updateChannelName).not.toHaveBeenCalled()
      expect(characterUIService.archiveChannel).not.toHaveBeenCalled()
      expect(characterUIService.removeCharacterEmbeds).not.toHaveBeenCalled()
    })

    it('通知送信が失敗しても握り潰して後続処理を続行する', async () => {
      // Arrange
      characterUIService.sendCharacterDeletionNotification.mockRejectedValue(new Error('notify boom'))
      const event = buildEvent()

      // Act & Assert: 再スローされない
      await expect(handler.handle(event)).resolves.toBeUndefined()
      // 後続のクリーンアップ・embed 削除は実行される
      expect(characterUIService.archiveChannel).toHaveBeenCalledWith('ch-1')
      expect(characterUIService.removeCharacterEmbeds).toHaveBeenCalledWith('ch-1')
    })

    it('チャンネルクリーンアップが失敗しても握り潰して embed 削除を続行する', async () => {
      // Arrange: archive とフォールバック emoji の双方を失敗させ handleChannelCleanup を throw させる
      characterUIService.archiveChannel.mockRejectedValue(new Error('archive boom'))
      characterUIService.addChannelArchiveEmoji.mockRejectedValue(new Error('emoji boom'))
      const event = buildEvent()

      // Act & Assert: handle は再スローしない
      await expect(handler.handle(event)).resolves.toBeUndefined()
      // cleanup 失敗後も embed 削除は実行される
      expect(characterUIService.removeCharacterEmbeds).toHaveBeenCalledWith('ch-1')
    })

    it('embed 削除が失敗しても握り潰して正常終了する', async () => {
      // Arrange
      characterUIService.removeCharacterEmbeds.mockRejectedValue(new Error('embed boom'))
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

  describe('handleChannelCleanup（handle 経由）', () => {
    it('archive 成功時はフォールバックの emoji 付与を呼ばない', async () => {
      // Arrange
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert
      expect(characterUIService.addChannelArchiveEmoji).not.toHaveBeenCalled()
    })

    it('archive 失敗時は addChannelArchiveEmoji へフォールバックする', async () => {
      // Arrange
      characterUIService.archiveChannel.mockRejectedValue(new Error('archive boom'))
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert: フォールバックが呼ばれ、致命的でないため handle は完了
      expect(characterUIService.addChannelArchiveEmoji).toHaveBeenCalledWith('ch-1')
    })

    it('チャンネル名は小文字化・空白ハイフン化される', async () => {
      // Arrange
      const event = buildEvent({ characterName: 'Sir Lancelot' })

      // Act
      await handler.handle(event)

      // Assert
      expect(characterUIService.updateChannelName).toHaveBeenCalledWith('ch-1', '🗄️-archived-sir-lancelot')
    })
  })
})
