// グローバル jest-setup の discord.js モックは EmbedBuilder.setTimestamp / Colors を欠くため、
// このファイルではローカルに補完したモックで上書きする（本体コードは未変更）。
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
  return {
    EmbedBuilder: jest.fn(chainableEmbed),
    Colors: { Blue: 0x0000ff, Red: 0xff0000 }
  }
})

import type { TextChannel } from 'discord.js'
import { DiceHistoryService } from './dice-history.service'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { DiceRollPaginationService } from './pagination/dice-roll-pagination.service'
import { BackgroundTaskErrorHandler } from 'src/core/http/error-handler'

// DiceHistoryService は履歴の取得(diceRollService) と整形/ページネーション(paginationService) を
// 組み合わせ parentChannel.send で出力する。副作用境界（2つの依存サービス・送信先 channel）は
// モックし、純粋整形(formatDiceRollHistory)はモックなしで直接検証する。
// 非同期メソッド updateDiceRollHistoryAsync は rate-limit 分岐とバックグラウンド起動を検証する。
type DiceRollServiceMock = {
  findTextsByChannelId: jest.Mock
  deleteOldRolls: jest.Mock
}
type PaginationMock = {
  createPaginatedEmbeds: jest.Mock
  createPaginationControls: jest.Mock
}

// parentChannel として最小限の TextChannel モック（send のみ使用）
const makeChannel = () => ({ send: jest.fn().mockResolvedValue(undefined) }) as unknown as TextChannel

describe('DiceHistoryService', () => {
  let diceRollService: DiceRollServiceMock
  let pagination: PaginationMock
  let service: DiceHistoryService

  beforeEach(() => {
    jest.clearAllMocks()
    diceRollService = {
      findTextsByChannelId: jest.fn().mockResolvedValue([]),
      deleteOldRolls: jest.fn().mockResolvedValue(0)
    }
    pagination = {
      createPaginatedEmbeds: jest.fn().mockResolvedValue([]),
      createPaginationControls: jest.fn().mockResolvedValue([])
    }
    service = new DiceHistoryService(
      diceRollService as unknown as DiceRollService,
      pagination as unknown as DiceRollPaginationService
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('formatDiceRollHistory（純粋整形）', () => {
    it('履歴が空のとき定型メッセージを返す', () => {
      // Act & Assert
      expect(service.formatDiceRollHistory([])).toBe('ダイスロール履歴がありません')
    })

    it('null が渡されても定型メッセージを返す', () => {
      expect(service.formatDiceRollHistory(null as unknown as unknown[])).toBe('ダイスロール履歴がありません')
    })

    it('各ロールを番号付き・キャラ名・結果で整形する', () => {
      // Arrange
      const rolls = [
        {
          createdAt: '2024-01-01T12:34:00Z',
          characterName: '探索者A',
          diceExpression: '1D100',
          result: 42,
          resultDetails: '(42)',
          reason: '幸運'
        }
      ]

      // Act
      const text = service.formatDiceRollHistory(rolls)

      // Assert
      expect(text).toContain('1. **探索者A**')
      expect(text).toContain('1D100 → **42**')
      expect(text).toContain('(幸運)')
      expect(text).toContain('(42)')
    })

    it('characterName が無いと Unknown で表示する', () => {
      const rolls = [{ createdAt: '2024-01-01T12:00:00Z', diceExpression: '1D6', result: 3 }]
      expect(service.formatDiceRollHistory(rolls)).toContain('**Unknown**')
    })
  })

  describe('getHistoryStatistics', () => {
    it('履歴が空のとき 0 件・平均0・lastRollTime null を返す', async () => {
      // Act
      const stats = await service.getHistoryStatistics('ch1')

      // Assert
      expect(stats).toEqual({ totalRolls: 0, averageResult: 0, lastRollTime: null })
    })

    it('複数履歴から件数と平均(小数2桁丸め)・先頭の createdAt を返す', async () => {
      // Arrange
      const createdAt = new Date('2024-01-01T00:00:00Z')
      diceRollService.findTextsByChannelId.mockResolvedValue([
        { result: 10, createdAt },
        { result: 5, createdAt: new Date('2023-12-31T00:00:00Z') }
      ])

      // Act
      const stats = await service.getHistoryStatistics('ch1')

      // Assert: (10+5)/2 = 7.5
      expect(stats.totalRolls).toBe(2)
      expect(stats.averageResult).toBe(7.5)
      expect(stats.lastRollTime).toBe(createdAt)
    })

    it('取得で例外が出ても 0 件のデフォルトを返す（握りつぶし）', async () => {
      // Arrange
      diceRollService.findTextsByChannelId.mockRejectedValue(new Error('db-boom'))

      // Act
      const stats = await service.getHistoryStatistics('ch1')

      // Assert
      expect(stats).toEqual({ totalRolls: 0, averageResult: 0, lastRollTime: null })
    })
  })

  describe('cleanupOldHistory', () => {
    it('deleteOldRolls に委譲し削除件数を返す', async () => {
      // Arrange
      diceRollService.deleteOldRolls.mockResolvedValue(3)

      // Act
      const deleted = await service.cleanupOldHistory('ch1', 500)

      // Assert
      expect(diceRollService.deleteOldRolls).toHaveBeenCalledWith('ch1', 500)
      expect(deleted).toBe(3)
    })

    it('例外時は 0 を返す（握りつぶし）', async () => {
      diceRollService.deleteOldRolls.mockRejectedValue(new Error('boom'))
      await expect(service.cleanupOldHistory('ch1')).resolves.toBe(0)
    })
  })

  describe('exportHistory', () => {
    it('データ無し・json のとき空配列文字列を返す', async () => {
      await expect(service.exportHistory('ch1', 'json')).resolves.toBe('[]')
    })

    it('データ無し・csv のとき "No data" を返す', async () => {
      await expect(service.exportHistory('ch1', 'csv')).resolves.toBe('No data')
    })

    it('csv 形式ではヘッダ行と各ロールの行を生成する', async () => {
      // Arrange
      diceRollService.findTextsByChannelId.mockResolvedValue([
        {
          createdAt: '2024-01-01T00:00:00Z',
          characterName: '探索者A',
          diceExpression: '1D100',
          result: 42,
          resultDetails: '(42)',
          reason: '幸運'
        }
      ])

      // Act
      const csv = await service.exportHistory('ch1', 'csv')

      // Assert
      expect(csv).toContain('Date,Character,Dice,Result,Details,Reason')
      expect(csv).toContain('探索者A')
      expect(csv).toContain('1D100')
    })

    it('json 形式では整形した JSON 文字列を返す', async () => {
      // Arrange
      const rolls = [{ result: 1 }]
      diceRollService.findTextsByChannelId.mockResolvedValue(rolls)

      // Act
      const json = await service.exportHistory('ch1', 'json')

      // Assert
      expect(JSON.parse(json)).toEqual(rolls)
    })

    it('取得で例外が出たら再スローする', async () => {
      diceRollService.findTextsByChannelId.mockRejectedValue(new Error('boom'))
      await expect(service.exportHistory('ch1')).rejects.toThrow('boom')
    })
  })

  describe('createPaginatedDiceRoll', () => {
    it('履歴が無いとき「履歴なし」エンベッドを送信する', async () => {
      // Arrange
      const channel = makeChannel()

      // Act
      await service.createPaginatedDiceRoll('ch1', channel)

      // Assert
      expect(channel.send).toHaveBeenCalledTimes(1)
      const arg = (channel.send as jest.Mock).mock.calls[0][0]
      expect(arg.embeds).toHaveLength(1)
    })

    it('履歴があるとき指定ページのエンベッドとコントロールを送信する', async () => {
      // Arrange
      diceRollService.findTextsByChannelId.mockResolvedValue([{ result: 1 }])
      pagination.createPaginatedEmbeds.mockResolvedValue(['embed-1', 'embed-2'])
      pagination.createPaginationControls.mockResolvedValue(['row'])
      const channel = makeChannel()

      // Act: page=2 → index 1
      await service.createPaginatedDiceRoll('ch1', channel, 2)

      // Assert
      expect(channel.send).toHaveBeenCalledWith({ embeds: ['embed-2'], components: ['row'] })
    })

    it('処理中に例外が出たらエラーエンベッドを送信する', async () => {
      // Arrange
      diceRollService.findTextsByChannelId.mockResolvedValue([{ result: 1 }])
      pagination.createPaginatedEmbeds.mockRejectedValue(new Error('boom'))
      const channel = makeChannel()

      // Act
      await service.createPaginatedDiceRoll('ch1', channel)

      // Assert: catch 内で再度 send（エラーエンベッド）
      expect(channel.send).toHaveBeenCalledTimes(1)
      const arg = (channel.send as jest.Mock).mock.calls[0][0]
      expect(arg.embeds).toHaveLength(1)
    })
  })

  describe('updateDiceRollHistoryAsync（rate-limit と背景起動）', () => {
    const diceResult = { total: 10, details: '(10)' }

    it('前回更新から間隔不足ならバックグラウンド更新を起動しない', async () => {
      // Arrange: Date.now を固定。1回目で時刻記録 → 直後の2回目は間隔不足。
      const now = 1_000_000
      jest.spyOn(Date, 'now').mockReturnValue(now)
      const channel = makeChannel()
      // 1回目: 時刻を記録し背景起動（findTextsByChannelId は空配列で send なし）
      await service.updateDiceRollHistoryAsync({} as never, 'ch1', channel, diceResult)
      await Promise.resolve()
      diceRollService.findTextsByChannelId.mockClear()

      // Act: 同時刻の2回目
      await service.updateDiceRollHistoryAsync({} as never, 'ch1', channel, diceResult)
      await Promise.resolve()

      // Assert: 間隔不足で背景処理(findTextsByChannelId)が走らない
      expect(diceRollService.findTextsByChannelId).not.toHaveBeenCalled()
    })

    it('間隔が空いていれば背景で履歴取得を起動する', async () => {
      // Arrange
      jest.spyOn(Date, 'now').mockReturnValue(2_000_000)
      diceRollService.findTextsByChannelId.mockResolvedValue([{ result: 1 }])
      const channel = makeChannel()

      // Act
      await service.updateDiceRollHistoryAsync({} as never, 'ch2', channel, diceResult)
      await Promise.resolve()
      await Promise.resolve()

      // Assert: 背景処理で履歴取得が呼ばれる
      expect(diceRollService.findTextsByChannelId).toHaveBeenCalledWith('ch2')
    })

    it('背景処理で例外が出ても BackgroundTaskErrorHandler に委譲し外側は解決する', async () => {
      // Arrange
      jest.spyOn(Date, 'now').mockReturnValue(3_000_000)
      const bgSpy = jest.spyOn(BackgroundTaskErrorHandler, 'handleBackgroundError').mockReturnValue(undefined)
      diceRollService.findTextsByChannelId.mockRejectedValue(new Error('bg-boom'))
      const channel = makeChannel()

      // Act
      await service.updateDiceRollHistoryAsync({} as never, 'ch3', channel, diceResult)
      // マイクロタスクを消化して背景 catch を発火させる
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      // Assert
      expect(bgSpy).toHaveBeenCalledWith(
        expect.any(Error),
        'updateDiceRollHistoryAsync',
        expect.objectContaining({ channelId: 'ch3' })
      )
    })
  })

  describe('clearUpdateInterval', () => {
    it('呼んでもエラーにならず内部状態をクリアする（後続更新が即時起動可能）', async () => {
      // Arrange: 一度更新時刻を記録
      jest.spyOn(Date, 'now').mockReturnValue(5_000_000)
      const channel = makeChannel()
      await service.updateDiceRollHistoryAsync({} as never, 'ch9', channel, { total: 1, details: '' })
      await Promise.resolve()
      diceRollService.findTextsByChannelId.mockClear()

      // Act: 間隔をクリアすれば同時刻でも再起動できる
      service.clearUpdateInterval('ch9')
      await service.updateDiceRollHistoryAsync({} as never, 'ch9', channel, { total: 1, details: '' })
      await Promise.resolve()

      // Assert: クリア後は背景処理が再び走る
      expect(diceRollService.findTextsByChannelId).toHaveBeenCalledWith('ch9')
    })
  })
})
