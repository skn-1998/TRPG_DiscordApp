// character-dice-history.pure の純粋（および semi-pure）ヘルパのユニットテスト。
//
// shouldUpdateEmbed / buildSaveTextDto / buildPaginationState は完全な純粋関数のためモック不要。
// createFallbackControls だけ discord.js Builder を使うため、customId/label/style/disabled を
// 捕捉できるローカルモックで discord.js を上書きする（pure 本体も同一モック参照を使うため一致する）。
jest.mock('discord.js', () => {
  const makeButton = () => {
    const state: { customId?: string; label?: string; style?: number; disabled?: boolean } = {}
    const button = {
      __state: state,
      setCustomId: jest.fn((id: string) => {
        state.customId = id
        return button
      }),
      setLabel: jest.fn((label: string) => {
        state.label = label
        return button
      }),
      setStyle: jest.fn((style: number) => {
        state.style = style
        return button
      }),
      setDisabled: jest.fn((disabled: boolean) => {
        state.disabled = disabled
        return button
      })
    }
    return button
  }
  const makeRow = () => {
    const row = {
      __components: [] as unknown[],
      addComponents: jest.fn((...components: unknown[]) => {
        row.__components.push(...components)
        return row
      })
    }
    return row
  }
  return {
    ButtonBuilder: jest.fn(makeButton),
    ActionRowBuilder: jest.fn(makeRow),
    ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 }
  }
})

import {
  shouldUpdateEmbed,
  buildSaveTextDto,
  buildPaginationState,
  createFallbackControls
} from './character-dice-history.pure'

describe('character-dice-history.pure', () => {
  describe('shouldUpdateEmbed（throttle 判定）', () => {
    const minInterval = 2000

    it('経過が minInterval 未満なら false（更新スキップ）', () => {
      expect(shouldUpdateEmbed(1000, 1000 + 1999, minInterval)).toBe(false)
    })

    it('経過がちょうど minInterval なら true（境界＝更新する）', () => {
      expect(shouldUpdateEmbed(1000, 1000 + 2000, minInterval)).toBe(true)
    })

    it('経過が minInterval を超えていれば true（更新する）', () => {
      expect(shouldUpdateEmbed(1000, 1000 + 5000, minInterval)).toBe(true)
    })

    it('lastUpdate が 0（初回相当）なら now>=minInterval で true', () => {
      expect(shouldUpdateEmbed(0, 2000, minInterval)).toBe(true)
      expect(shouldUpdateEmbed(0, 1999, minInterval)).toBe(false)
    })

    it('now と lastUpdate が同値（経過0）なら false', () => {
      expect(shouldUpdateEmbed(5000, 5000, minInterval)).toBe(false)
    })
  })

  describe('buildSaveTextDto（保存DTO組立）', () => {
    it('引数から DTO を組み立て、userId は system・後方互換キーを含む', () => {
      // Act
      const dto = buildSaveTextDto({
        textId: 'uuid-123',
        channelId: 'ch-1',
        diceCommand: '2d6',
        result: 7,
        resultText: 'result-text',
        characterId: 'cid-1',
        characterName: '探索者A'
      })

      // Assert
      expect(dto).toEqual({
        textId: 'uuid-123',
        channelId: 'ch-1',
        userId: 'system',
        diceExpression: '2d6',
        result: 7,
        resultDetails: 'result-text',
        characterId: 'cid-1',
        characterName: '探索者A',
        text: 'result-text',
        diceRoll: '2d6',
        discordChannelId: 'ch-1'
      })
    })

    it('textId（uuid）は引数で注入された値がそのまま使われる（純粋性の担保）', () => {
      const dto = buildSaveTextDto({
        textId: 'fixed-uuid',
        channelId: 'ch-x',
        diceCommand: '1d100',
        result: 50,
        resultText: 'r',
        characterId: 'cid-x',
        characterName: 'X'
      })
      expect(dto.textId).toBe('fixed-uuid')
    })
  })

  describe('buildPaginationState（ページネーション状態組立）', () => {
    it('pages 配列から totalPages を算出し currentPage=0・characterId=undefined を設定する', () => {
      const pages = ['embed-1', 'embed-2', 'embed-3']
      const state = buildPaginationState(pages, 'msg-1')

      expect(state).toEqual({
        pages,
        totalPages: 3,
        currentPage: 0,
        characterId: undefined,
        messageId: 'msg-1'
      })
    })

    it('空配列なら totalPages=0', () => {
      const state = buildPaginationState([], 'msg-empty')
      expect(state.totalPages).toBe(0)
      expect(state.pages).toEqual([])
    })

    it('要素1つなら totalPages=1（空ページ相当）', () => {
      const state = buildPaginationState(['only'], 'msg-1')
      expect(state.totalPages).toBe(1)
    })
  })

  describe('createFallbackControls（フォールバックコントロール）', () => {
    it('1 行（ActionRow）を返す', () => {
      const rows = createFallbackControls('msg-1', 'ch-1')
      expect(rows).toHaveLength(1)
    })

    it('3 つのボタン（prev / page-info / next）を含む', () => {
      const rows = createFallbackControls('msg-1', 'ch-1')
      const components = (rows[0] as unknown as { __components: unknown[] }).__components
      expect(components).toHaveLength(3)
    })

    it('各ボタンの customId 形が "dice-prev*${messageId}*${channelId}" 等で不変', () => {
      const rows = createFallbackControls('MID', 'CID')
      const buttons = (rows[0] as unknown as { __components: { __state: { customId?: string } }[] }).__components

      expect(buttons[0].__state.customId).toBe('dice-prev*MID*CID')
      expect(buttons[1].__state.customId).toBe('dice-page-info*MID*CID')
      expect(buttons[2].__state.customId).toBe('dice-next*MID*CID')
    })

    it('ラベルとスタイルが期待どおり（prev/next は Primary、page-info は Secondary かつ disabled）', () => {
      const rows = createFallbackControls('MID', 'CID')
      const buttons = (
        rows[0] as unknown as {
          __components: { __state: { label?: string; style?: number; disabled?: boolean } }[]
        }
      ).__components

      // prev
      expect(buttons[0].__state.label).toBe('◀ 前へ')
      expect(buttons[0].__state.style).toBe(1) // Primary
      // page-info（無効化された情報ボタン）
      expect(buttons[1].__state.label).toBe('ページ 1')
      expect(buttons[1].__state.style).toBe(2) // Secondary
      expect(buttons[1].__state.disabled).toBe(true)
      // next
      expect(buttons[2].__state.label).toBe('次へ ▶')
      expect(buttons[2].__state.style).toBe(1) // Primary
    })
  })
})
