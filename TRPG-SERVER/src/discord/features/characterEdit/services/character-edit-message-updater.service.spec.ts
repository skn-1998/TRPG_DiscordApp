import { Test, TestingModule } from '@nestjs/testing'
import { HttpException, Logger } from '@nestjs/common'
import { CharacterEditMessageUpdaterService } from './character-edit-message-updater.service'
import { CharacterEmbedManagerService } from './character-embed-manager.service'
import { Character } from '../../../../domains/character/models/character.model'
import { ErrorHandler } from '../../../../core/http/error-handler'

/**
 * Characterization tests for CharacterEditMessageUpdaterService.
 *
 * 目的: refresh ボタン押下時の「既存 characterEdit メッセージ探索 → 編集 / 新規送信フォールバック」の
 * 現挙動を固定する安全網。副作用の境界（embedManager・interaction.channel）のみモックし、
 * メッセージ判定は実 util（messageHasCharacterEditButtons）をそのまま使う。
 */

describe('CharacterEditMessageUpdaterService', () => {
  let service: CharacterEditMessageUpdaterService
  let module: TestingModule
  let embedManager: jest.Mocked<Pick<CharacterEmbedManagerService, 'createSectionedEmbeds'>>
  let warnSpy: jest.SpyInstance

  const SECTIONED = { embeds: ['embed-stub'], components: ['component-stub'] } as any

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    embedManager = { createSectionedEmbeds: jest.fn().mockResolvedValue(SECTIONED) }

    module = await Test.createTestingModule({
      providers: [CharacterEditMessageUpdaterService, { provide: CharacterEmbedManagerService, useValue: embedManager }]
    }).compile()

    service = module.get<CharacterEditMessageUpdaterService>(CharacterEditMessageUpdaterService)
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await module.close()
    jest.restoreAllMocks()
  })

  /** テスト対象に渡す最小限の Character スタブ */
  const buildCharacter = (overrides: Partial<Character> = {}): Character =>
    ({
      characterId: 'char-1',
      characterName: 'テストキャラ',
      ...overrides
    }) as Character

  /**
   * characterEdit ボタンを「含む / 含まない」メッセージスタブを生成する。
   * messageHasCharacterEditButtons の判定条件（bot 発・type=2 ボタン・customId 一致）に合わせる。
   */
  const buildMessage = (match: boolean, characterId = 'char-1') => ({
    author: { bot: true },
    components: match
      ? [{ components: [{ type: 2, customId: `character-refresh-${characterId}` }] }]
      : [{ components: [{ type: 2, customId: 'unrelated-button' }] }],
    edit: jest.fn().mockResolvedValue(undefined)
  })

  /** .values() で Message を回せる Collection 風スタブ */
  const buildMessagesCollection = (messages: unknown[]) => ({
    values: () => messages[Symbol.iterator]()
  })

  /**
   * interaction スタブを生成する。
   * @param messages fetch が返す Message 群（null を渡すと channel.messages 自体を無効化）
   */
  const buildInteraction = (opts: {
    messages?: unknown[]
    hasMessages?: boolean
    hasSend?: boolean
    sendImpl?: jest.Mock
    fetchImpl?: jest.Mock
  }) => {
    const { messages = [], hasMessages = true, hasSend = true, sendImpl, fetchImpl } = opts

    const send = sendImpl ?? jest.fn().mockResolvedValue(undefined)
    const fetch = fetchImpl ?? jest.fn().mockResolvedValue(buildMessagesCollection(messages))

    const channel: Record<string, unknown> = {}
    if (hasMessages) channel.messages = { fetch }
    if (hasSend) channel.send = send

    return {
      interaction: {
        channel,
        user: { id: 'user-1' },
        replied: false,
        deferred: true,
        reply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined)
      } as any,
      send,
      fetch
    }
  }

  describe('updateExistingCharacterEditEmbed', () => {
    it('channelがnullの場合はwarnで早期returnし、embedManagerを呼ばない', async () => {
      // Arrange
      const character = buildCharacter()
      const interaction = { channel: null, user: { id: 'user-1' } } as any

      // Act
      await service.updateExistingCharacterEditEmbed(character, interaction)

      // Assert
      expect(embedManager.createSectionedEmbeds).not.toHaveBeenCalled()
    })

    it('channelにmessagesが無い場合はwarnで早期returnし、embedManagerを呼ばない', async () => {
      // Arrange
      const character = buildCharacter()
      const interaction = { channel: { send: jest.fn() }, user: { id: 'user-1' } } as any

      // Act
      await service.updateExistingCharacterEditEmbed(character, interaction)

      // Assert
      expect(embedManager.createSectionedEmbeds).not.toHaveBeenCalled()
    })

    it('該当メッセージが見つかった場合は既存メッセージをeditで更新する', async () => {
      // Arrange
      const character = buildCharacter()
      const matchingMessage = buildMessage(true)
      const { interaction, send } = buildInteraction({ messages: [matchingMessage] })

      // Act
      await service.updateExistingCharacterEditEmbed(character, interaction)

      // Assert: edit が SECTIONED + content で呼ばれ、新規送信はしない
      expect(matchingMessage.edit).toHaveBeenCalledWith({
        content: '🔄 テストキャラの情報を更新しました',
        embeds: SECTIONED.embeds,
        components: SECTIONED.components
      })
      expect(send).not.toHaveBeenCalled()
      expect(embedManager.createSectionedEmbeds).toHaveBeenCalledWith(character)
    })

    it('該当メッセージが見つからない場合はchannel.sendで新規送信する', async () => {
      // Arrange
      const character = buildCharacter()
      const nonMatching = buildMessage(false)
      const { interaction, send } = buildInteraction({ messages: [nonMatching] })

      // Act
      await service.updateExistingCharacterEditEmbed(character, interaction)

      // Assert: send が SECTIONED + content で呼ばれ、edit は呼ばれない
      expect(send).toHaveBeenCalledWith({
        content: '🔄 テストキャラの情報を更新しました',
        embeds: SECTIONED.embeds,
        components: SECTIONED.components
      })
      expect(nonMatching.edit).not.toHaveBeenCalled()
      expect(interaction.reply).not.toHaveBeenCalled()
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.followUp).not.toHaveBeenCalled()
    })

    it('本体tryで例外が発生したらfallback送信後にErrorHandlerから再スローする', async () => {
      // Arrange: fetch を失敗させて本体 try を例外にする
      const character = buildCharacter()
      const originalError = new Error('fetch failed')
      const handleServiceError = jest.spyOn(ErrorHandler, 'handleServiceError')
      const fetchImpl = jest.fn().mockRejectedValue(originalError)
      const { interaction, send } = buildInteraction({ fetchImpl })

      // Act & Assert
      await expect(service.updateExistingCharacterEditEmbed(character, interaction)).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )

      expect(send).toHaveBeenCalledWith({
        content: '🔄 テストキャラの情報を更新しました',
        embeds: SECTIONED.embeds,
        components: SECTIONED.components
      })
      expect(handleServiceError).toHaveBeenCalledWith(
        originalError,
        { characterId: 'char-1', userId: 'user-1' },
        'CharacterEditMessageUpdaterService'
      )
      expect(send.mock.invocationCallOrder[0]).toBeLessThan(handleServiceError.mock.invocationCallOrder[0])
      expect(interaction.reply).not.toHaveBeenCalled()
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.followUp).not.toHaveBeenCalled()
    })

    it('本体例外時にchannelへsendが無くてもErrorHandlerから再スローする', async () => {
      // Arrange: fetch 失敗 かつ channel に send 無し
      const character = buildCharacter()
      const fetchImpl = jest.fn().mockRejectedValue(new Error('fetch failed'))
      const { interaction } = buildInteraction({ fetchImpl, hasSend: false })

      // Act & Assert
      await expect(service.updateExistingCharacterEditEmbed(character, interaction)).rejects.toThrow(
        'サービス処理中にエラーが発生しました'
      )
    })

    it('fallback送信も失敗しても元の HttpException を伝播する', async () => {
      // Arrange: fetch も fallback send も失敗させる
      const character = buildCharacter()
      const originalError = new HttpException('original update failure', 409)
      const handleServiceError = jest.spyOn(ErrorHandler, 'handleServiceError')
      const fetchImpl = jest.fn().mockRejectedValue(originalError)
      const fallbackError = new Error('send failed')
      const sendImpl = jest.fn().mockRejectedValue(fallbackError)
      const { interaction } = buildInteraction({ fetchImpl, sendImpl })

      // Act & Assert
      await expect(service.updateExistingCharacterEditEmbed(character, interaction)).rejects.toBe(originalError)
      expect(handleServiceError).toHaveBeenCalledWith(
        originalError,
        { characterId: 'char-1', userId: 'user-1' },
        'CharacterEditMessageUpdaterService'
      )
      expect(sendImpl.mock.invocationCallOrder[0]).toBeLessThan(handleServiceError.mock.invocationCallOrder[0])
      expect(warnSpy).toHaveBeenCalledWith('Fallback message sending also failed', fallbackError)
      expect(interaction.reply).not.toHaveBeenCalled()
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.followUp).not.toHaveBeenCalled()
    })
  })
})
