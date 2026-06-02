// グローバル jest-setup の discord.js モックは EmbedBuilder.setTimestamp / ButtonBuilder.setDisabled を
// 欠くため、このファイルではローカルに補完したモックで上書きする（本体コードは未変更）。
// characterization テスト：抽出前後で同じ挙動が緑であることを担保する安全網。
jest.mock('discord.js', () => {
  const chainableEmbed = () => {
    const embed = {
      setTitle: jest.fn(() => embed),
      setDescription: jest.fn(() => embed),
      setColor: jest.fn(() => embed),
      setTimestamp: jest.fn(() => embed),
      addFields: jest.fn(() => embed)
    }
    return embed
  }
  const chainableButton = () => {
    const button = {
      setCustomId: jest.fn(() => button),
      setLabel: jest.fn(() => button),
      setStyle: jest.fn(() => button),
      setDisabled: jest.fn(() => button)
    }
    return button
  }
  const chainableRow = () => {
    const row = { addComponents: jest.fn(() => row) }
    return row
  }
  return {
    EmbedBuilder: jest.fn(chainableEmbed),
    ButtonBuilder: jest.fn(chainableButton),
    ActionRowBuilder: jest.fn(chainableRow),
    ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 }
  }
})

import type { ButtonInteraction, TextChannel } from 'discord.js'
import { CharacterDiceHistoryService } from './character-dice-history.service'
import { DiceRollService } from '../../../domains/dice-roll/dice-roll.service'
import { DiceRollPaginationService } from '../../components/pagination/dice-roll-pagination.service'
import { CharacterService } from '../../../domains/character/character.service'
import { BackgroundTaskErrorHandler } from '../../../utils/error-handler'

// 副作用境界（3つの注入サービス・discord.js I/O）はモックし、現挙動を固定する。
type DiceRollServiceMock = {
  createText: jest.Mock
  findChannelByChannelId: jest.Mock
  createPaginatedEmbeds?: jest.Mock
  updateEmbed: jest.Mock
}
type PaginationMock = {
  invalidateCache: jest.Mock
  createPaginatedEmbeds: jest.Mock
  createPaginationControls: jest.Mock
  savePaginationState: jest.Mock
}
type CharacterServiceMock = {
  findByChannelId: jest.Mock
}

const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) {
    await Promise.resolve()
  }
}

// parentChannel として最小限の TextChannel モック
const makeChannel = (overrides: Record<string, unknown> = {}) =>
  ({
    isTextBased: jest.fn().mockReturnValue(true),
    messages: { fetch: jest.fn() },
    send: jest.fn().mockResolvedValue({ id: 'new-msg', edit: jest.fn().mockResolvedValue(undefined) }),
    ...overrides
  }) as unknown as TextChannel

const makeInteraction = (channelFetch?: jest.Mock) =>
  ({
    id: 'interaction-1',
    user: { id: 'user-1' },
    client: { channels: { fetch: channelFetch ?? jest.fn() } }
  }) as unknown as ButtonInteraction

describe('CharacterDiceHistoryService (characterization)', () => {
  let diceRollService: DiceRollServiceMock
  let pagination: PaginationMock
  let characterService: CharacterServiceMock
  let service: CharacterDiceHistoryService

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    diceRollService = {
      createText: jest.fn().mockResolvedValue(undefined),
      findChannelByChannelId: jest.fn().mockResolvedValue(null),
      updateEmbed: jest.fn().mockResolvedValue(undefined)
    }
    pagination = {
      invalidateCache: jest.fn(),
      createPaginatedEmbeds: jest.fn().mockResolvedValue([]),
      createPaginationControls: jest.fn().mockResolvedValue([]),
      savePaginationState: jest.fn()
    }
    characterService = {
      findByChannelId: jest.fn().mockResolvedValue(null)
    }
    service = new CharacterDiceHistoryService(
      diceRollService as unknown as DiceRollService,
      pagination as unknown as DiceRollPaginationService,
      characterService as unknown as CharacterService
    )
    jest.spyOn(BackgroundTaskErrorHandler, 'handleBackgroundError').mockReturnValue(undefined)
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe('saveRollResult', () => {
    it('キャラクターが見つからない場合は保存せず return する', async () => {
      characterService.findByChannelId.mockResolvedValue(null)

      await service.saveRollResult('探索者A', 'result', 42, '1d100', 'ch1')

      expect(characterService.findByChannelId).toHaveBeenCalledWith('ch1')
      expect(diceRollService.createText).not.toHaveBeenCalled()
    })

    it('キャラクターが見つかれば createText に保存DTOを渡し、成功時にキャッシュ無効化する', async () => {
      characterService.findByChannelId.mockResolvedValue({
        characterId: 'cid-1',
        characterName: '探索者A'
      })

      await service.saveRollResult('探索者A', 'result-text', 7, '2d6', 'ch1')
      await flush()

      expect(diceRollService.createText).toHaveBeenCalledTimes(1)
      const dto = diceRollService.createText.mock.calls[0][0]
      // DTO のキー・値（uuid 以外）を固定
      expect(dto.channelId).toBe('ch1')
      expect(dto.userId).toBe('system')
      expect(dto.diceExpression).toBe('2d6')
      expect(dto.result).toBe(7)
      expect(dto.resultDetails).toBe('result-text')
      expect(dto.characterId).toBe('cid-1')
      expect(dto.characterName).toBe('探索者A')
      expect(dto.text).toBe('result-text')
      expect(dto.diceRoll).toBe('2d6')
      expect(dto.discordChannelId).toBe('ch1')
      expect(typeof dto.textId).toBe('string')
      // 成功 then 内でキャッシュ無効化
      expect(pagination.invalidateCache).toHaveBeenCalledWith('ch1')
    })

    it('createText が失敗してもバックグラウンドハンドラに委譲し外側は解決する', async () => {
      characterService.findByChannelId.mockResolvedValue({
        characterId: 'cid-1',
        characterName: '探索者A'
      })
      diceRollService.createText.mockRejectedValue(new Error('db-boom'))

      await service.saveRollResult('探索者A', 'r', 1, '1d6', 'ch1')
      await flush()

      expect(BackgroundTaskErrorHandler.handleBackgroundError).toHaveBeenCalledWith(
        expect.any(Error),
        'save-dice-roll-result',
        expect.objectContaining({ characterId: 'cid-1', channelId: 'ch1' })
      )
    })
  })

  describe('createPaginatedDiceRoll', () => {
    it('embedId が無ければ新規メッセージを送信し、pages が空なら空Embedで編集する', async () => {
      diceRollService.findChannelByChannelId.mockResolvedValue(null)
      pagination.createPaginatedEmbeds.mockResolvedValue([])
      const edit = jest.fn().mockResolvedValue(undefined)
      const channel = makeChannel({
        send: jest.fn().mockResolvedValue({ id: 'new-msg', edit })
      })

      await service.createPaginatedDiceRoll(makeInteraction(), channel, 'ch1')

      // 新規送信 → 空Embedで編集
      expect((channel as unknown as { send: jest.Mock }).send).toHaveBeenCalledTimes(1)
      expect(edit).toHaveBeenCalledTimes(1)
      expect(pagination.savePaginationState).toHaveBeenCalled()
    })

    it('embedId 既存かつメッセージ取得成功なら既存メッセージを編集して return する（新規 send しない）', async () => {
      diceRollService.findChannelByChannelId.mockResolvedValue({ embedId: 'existing-msg' })
      pagination.createPaginatedEmbeds.mockResolvedValue(['embed-1'])
      pagination.createPaginationControls.mockResolvedValue(['row'])
      const edit = jest.fn().mockResolvedValue(undefined)
      const channel = makeChannel({
        messages: { fetch: jest.fn().mockResolvedValue({ id: 'existing-msg', edit }) },
        send: jest.fn()
      })

      await service.createPaginatedDiceRoll(makeInteraction(), channel, 'ch1')

      expect(edit).toHaveBeenCalledWith({
        content: null,
        embeds: ['embed-1'],
        components: ['row']
      })
      expect((channel as unknown as { send: jest.Mock }).send).not.toHaveBeenCalled()
      expect(pagination.savePaginationState).toHaveBeenCalledWith('ch1', 'existing-msg', expect.any(Object))
    })

    it('コントロール生成が空配列ならフォールバックコントロールで編集する', async () => {
      diceRollService.findChannelByChannelId.mockResolvedValue(null)
      pagination.createPaginatedEmbeds.mockResolvedValue(['embed-1'])
      pagination.createPaginationControls.mockResolvedValue([]) // 空 → fallback
      const edit = jest.fn().mockResolvedValue(undefined)
      const channel = makeChannel({
        send: jest.fn().mockResolvedValue({ id: 'new-msg', edit })
      })

      await service.createPaginatedDiceRoll(makeInteraction(), channel, 'ch1')

      // フォールバック編集が行われ、embeds は pages[0]
      const editArg = edit.mock.calls[edit.mock.calls.length - 1][0]
      expect(editArg.embeds).toEqual(['embed-1'])
      expect(Array.isArray(editArg.components)).toBe(true)
      expect(editArg.components.length).toBe(1)
    })

    it('ロック中（同チャンネルで処理進行中）なら即 return する', async () => {
      // 1回目を解決させずに保留させ、その間に2回目を呼ぶ
      diceRollService.findChannelByChannelId.mockReturnValue(new Promise(() => {}))
      const channel = makeChannel()

      // 1回目（保留）
      const p1 = service.createPaginatedDiceRoll(makeInteraction(), channel, 'lockch')
      // 2回目（ロック中で即 return）
      await service.createPaginatedDiceRoll(makeInteraction(), channel, 'lockch')

      // 2回目では findChannelByChannelId は1回しか呼ばれていない（1回目の分のみ）
      expect(diceRollService.findChannelByChannelId).toHaveBeenCalledTimes(1)
      void p1
    })
  })

  describe('updateDiceRollHistoryAsync（throttle 分岐）', () => {
    it('embedId 既存・初回は更新時刻を記録し、既存メッセージを編集する', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
      diceRollService.findChannelByChannelId.mockResolvedValue({ embedId: 'msg-1' })
      pagination.createPaginatedEmbeds.mockResolvedValue(['embed-1'])
      pagination.createPaginationControls.mockResolvedValue(['row'])
      const edit = jest.fn().mockResolvedValue(undefined)
      const channel = makeChannel({
        messages: { fetch: jest.fn().mockResolvedValue({ id: 'msg-1', edit }) }
      })

      await service.updateDiceRollHistoryAsync(makeInteraction(), channel, 'chU')
      await flush()

      expect(edit).toHaveBeenCalled()
      expect(pagination.savePaginationState).toHaveBeenCalled()
    })

    it('前回更新から MIN_UPDATE_INTERVAL 未満ならスキップ（メッセージ取得しない）', async () => {
      diceRollService.findChannelByChannelId.mockResolvedValue({ embedId: 'msg-1' })
      const fetch = jest.fn().mockResolvedValue({ id: 'msg-1', edit: jest.fn() })
      pagination.createPaginatedEmbeds.mockResolvedValue(['embed-1'])
      pagination.createPaginationControls.mockResolvedValue(['row'])
      const channel = makeChannel({ messages: { fetch } })

      // 1回目（記録）
      jest.spyOn(Date, 'now').mockReturnValue(2_000_000)
      await service.updateDiceRollHistoryAsync(makeInteraction(), channel, 'chT')
      await flush()
      fetch.mockClear()

      // 2回目：1500ms 後（< 2000）
      ;(Date.now as jest.Mock).mockReturnValue(2_001_500)
      await service.updateDiceRollHistoryAsync(makeInteraction(), channel, 'chT')
      await flush()

      expect(fetch).not.toHaveBeenCalled()
    })

    it('前回更新から MIN_UPDATE_INTERVAL 以上経過していれば更新する', async () => {
      diceRollService.findChannelByChannelId.mockResolvedValue({ embedId: 'msg-1' })
      const edit = jest.fn().mockResolvedValue(undefined)
      const fetch = jest.fn().mockResolvedValue({ id: 'msg-1', edit })
      pagination.createPaginatedEmbeds.mockResolvedValue(['embed-1'])
      pagination.createPaginationControls.mockResolvedValue(['row'])
      const channel = makeChannel({ messages: { fetch } })

      jest.spyOn(Date, 'now').mockReturnValue(3_000_000)
      await service.updateDiceRollHistoryAsync(makeInteraction(), channel, 'chT2')
      await flush()
      fetch.mockClear()
      edit.mockClear()

      // 2回目：2500ms 後（>= 2000）
      ;(Date.now as jest.Mock).mockReturnValue(3_002_500)
      await service.updateDiceRollHistoryAsync(makeInteraction(), channel, 'chT2')
      await flush()

      expect(fetch).toHaveBeenCalled()
      expect(edit).toHaveBeenCalled()
    })

    it('embedId が無ければ createPaginatedDiceRoll を起動する（新規送信）', async () => {
      diceRollService.findChannelByChannelId.mockResolvedValue({ embedId: undefined })
      pagination.createPaginatedEmbeds.mockResolvedValue([])
      const send = jest.fn().mockResolvedValue({ id: 'new-msg', edit: jest.fn().mockResolvedValue(undefined) })
      const channel = makeChannel({ send })

      await service.updateDiceRollHistoryAsync(makeInteraction(), channel, 'chNew')
      await flush()

      expect(send).toHaveBeenCalled()
    })
  })

  describe('handleParentChannelMessage（throttle スロットル経路）', () => {
    it('前回更新から間隔不足ならページネーション作成を起動しない（throttle スキップ）', async () => {
      const channelFetch = jest.fn().mockResolvedValue(makeChannel())
      const interaction = makeInteraction(channelFetch)
      diceRollService.findChannelByChannelId.mockResolvedValue(null)
      characterService.findByChannelId.mockResolvedValue(null)

      // 1回目：時刻記録（>= interval）。createPaginatedDiceRoll が起動して send される
      jest.spyOn(Date, 'now').mockReturnValue(10_000_000)
      await service.handleParentChannelMessage(interaction, 'parent-ch', {} as never, '探索者A', 'r', 1, '1d6')
      await flush()

      // 2回目：間隔不足
      ;(Date.now as jest.Mock).mockReturnValue(10_000_500)
      const channel2 = makeChannel()
      const channelFetch2 = jest.fn().mockResolvedValue(channel2)
      const interaction2 = makeInteraction(channelFetch2)
      await service.handleParentChannelMessage(interaction2, 'parent-ch', {} as never, '探索者A', 'r', 1, '1d6')
      await flush()

      // throttle スキップで send は呼ばれない
      expect((channel2 as unknown as { send: jest.Mock }).send).not.toHaveBeenCalled()
    })
  })
})
