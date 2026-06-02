import { CommandInteraction } from 'discord.js'
import { handleError } from './discord.utils'

describe('discord.utils', () => {
  describe('handleError', () => {
    let consoleErrorSpy: jest.SpyInstance

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    // handleError が参照するプロパティ/メソッドだけを持つ最小 mock。
    // discord.js の厳格な CommandInteraction 型は使わず、必要な形だけを表現する。
    const createInteraction = (overrides: Record<string, unknown> = {}): CommandInteraction => {
      return {
        isRepliable: jest.fn().mockReturnValue(true),
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
        ...overrides
      } as unknown as CommandInteraction
    }

    describe('Error インスタンスの場合', () => {
      it('未応答なら reply でエラーメッセージを ephemeral 返信する', async () => {
        // Arrange
        const interaction = createInteraction()

        // Act
        await handleError(interaction, new Error('boom'))

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith({
          content: 'エラーが発生しました: boom',
          ephemeral: true
        })
        expect(interaction.followUp).not.toHaveBeenCalled()
      })

      it('応答済み(replied)なら followUp でエラーメッセージを返す', async () => {
        // Arrange
        const interaction = createInteraction({ replied: true })

        // Act
        await handleError(interaction, new Error('boom'))

        // Assert
        expect(interaction.followUp).toHaveBeenCalledWith({
          content: 'エラーが発生しました: boom',
          ephemeral: true
        })
        expect(interaction.reply).not.toHaveBeenCalled()
      })

      it('遅延応答(deferred)なら followUp でエラーメッセージを返す', async () => {
        // Arrange
        const interaction = createInteraction({ deferred: true })

        // Act
        await handleError(interaction, new Error('boom'))

        // Assert
        expect(interaction.followUp).toHaveBeenCalledWith({
          content: 'エラーが発生しました: boom',
          ephemeral: true
        })
      })

      it('応答不可能(isRepliable=false)なら何も送信しない', async () => {
        // Arrange
        const interaction = createInteraction({ isRepliable: jest.fn().mockReturnValue(false) })

        // Act
        await handleError(interaction, new Error('boom'))

        // Assert
        expect(interaction.reply).not.toHaveBeenCalled()
        expect(interaction.followUp).not.toHaveBeenCalled()
      })
    })

    describe('Error 以外(未知のエラー)の場合', () => {
      it('未応答なら reply で未知エラーメッセージを ephemeral 返信する', async () => {
        // Arrange
        const interaction = createInteraction()

        // Act
        await handleError(interaction, 'not-an-error')

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith({
          content: '未知のエラーが発生しました。もう一度お試しください。',
          ephemeral: true
        })
      })

      it('応答済みなら followUp で未知エラーメッセージを返す', async () => {
        // Arrange
        const interaction = createInteraction({ replied: true })

        // Act
        await handleError(interaction, null)

        // Assert
        expect(interaction.followUp).toHaveBeenCalledWith({
          content: '未知のエラーが発生しました。もう一度お試しください。',
          ephemeral: true
        })
      })

      it('応答不可能なら何も送信しない', async () => {
        // Arrange
        const interaction = createInteraction({ isRepliable: jest.fn().mockReturnValue(false) })

        // Act
        await handleError(interaction, undefined)

        // Assert
        expect(interaction.reply).not.toHaveBeenCalled()
        expect(interaction.followUp).not.toHaveBeenCalled()
      })
    })

    describe('応答処理が例外を投げた場合', () => {
      it('例外を握りつぶして console.error に記録し、再 throw しない', async () => {
        // Arrange
        const replyError = new Error('reply-failed')
        const interaction = createInteraction({
          reply: jest.fn().mockRejectedValue(replyError)
        })

        // Act / Assert: throw されないこと
        await expect(handleError(interaction, new Error('boom'))).resolves.toBeUndefined()
        expect(consoleErrorSpy).toHaveBeenCalledWith('エラー応答中にさらにエラーが発生しました:', replyError)
      })
    })
  })
})
