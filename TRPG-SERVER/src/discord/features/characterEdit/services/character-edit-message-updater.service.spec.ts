import { Test, TestingModule } from '@nestjs/testing'
import { CharacterEditMessageUpdaterService } from './character-edit-message-updater.service'
import { CharacterEmbedManagerService } from './character-embed-manager.service'
import { Character } from '../../../../domains/character/models/character.model'
import { ErrorHandler } from '../../../../core/http/error-handler'

/**
 * Characterization tests for CharacterEditMessageUpdaterService.
 *
 * 目的: refresh ボタン押下時の「既存 characterEdit メッセージ探索 → 編集 / 新規送信フォールバック」の
 * 現挙動を固定する安全網。副作用の境界（embedManager・ErrorHandler・interaction.channel）のみモックし、
 * メッセージ判定は実 util（messageHasCharacterEditButtons）をそのまま使う。
 */

// ErrorHandler.handleServiceError は実装が常に throw する。
// fallback 経路（catch 後の再送信）を検証するため、副作用の境界としてスタブ化する。
jest.mock('../../../../core/http/error-handler', () => ({
  ErrorHandler: {
    handleServiceError: jest.fn()
  }
}))

describe('CharacterEditMessageUpdaterService', () => {
  let service: CharacterEditMessageUpdaterService
  let module: TestingModule
  let embedManager: jest.Mocked<Pick<CharacterEmbedManagerService, 'createSectionedEmbeds'>>

  const SECTIONED = { embeds: ['embed-stub'], components: ['component-stub'] } as any

  beforeEach(async () => {
    embedManager = { createSectionedEmbeds: jest.fn().mockResolvedValue(SECTIONED) }

    module = await Test.createTestingModule({
      providers: [CharacterEditMessageUpdaterService, { provide: CharacterEmbedManagerService, useValue: embedManager }]
    }).compile()

    service = module.get<CharacterEditMessageUpdaterService>(CharacterEditMessageUpdaterService)
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await module.close()
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
        user: { id: 'user-1' }
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
    })

    it('本体tryで例外が発生したらErrorHandlerを呼び、fallbackでchannel.sendを実行する', async () => {
      // Arrange: fetch を失敗させて本体 try を例外にする
      const character = buildCharacter()
      const fetchImpl = jest.fn().mockRejectedValue(new Error('fetch failed'))
      const { interaction, send } = buildInteraction({ fetchImpl })

      // Act
      await service.updateExistingCharacterEditEmbed(character, interaction)

      // Assert: ErrorHandler 経由後、fallback の send が実行される
      expect(ErrorHandler.handleServiceError).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith({
        content: '🔄 テストキャラの情報を更新しました',
        embeds: SECTIONED.embeds,
        components: SECTIONED.components
      })
    })

    it('本体例外時にchannelへsendが無ければfallback送信をしない', async () => {
      // Arrange: fetch 失敗 かつ channel に send 無し
      const character = buildCharacter()
      const fetchImpl = jest.fn().mockRejectedValue(new Error('fetch failed'))
      const { interaction } = buildInteraction({ fetchImpl, hasSend: false })

      // Act & Assert: 例外を握りつぶし（再スローしない）、ErrorHandler は呼ばれる
      await expect(service.updateExistingCharacterEditEmbed(character, interaction)).resolves.toBeUndefined()
      expect(ErrorHandler.handleServiceError).toHaveBeenCalledTimes(1)
    })

    it('fallbackのsendも例外なら再スローせずvoidで解決する', async () => {
      // Arrange: fetch も fallback send も失敗させる
      const character = buildCharacter()
      const fetchImpl = jest.fn().mockRejectedValue(new Error('fetch failed'))
      const sendImpl = jest.fn().mockRejectedValue(new Error('send failed'))
      const { interaction } = buildInteraction({ fetchImpl, sendImpl })

      // Act & Assert: fallback も失敗するが例外は外に漏れない
      await expect(service.updateExistingCharacterEditEmbed(character, interaction)).resolves.toBeUndefined()
      expect(ErrorHandler.handleServiceError).toHaveBeenCalledTimes(1)
    })
  })
})
