import {
  getResultEmoji,
  formatResultText,
  getSuccessText,
  formatDiceRollResultAsText
} from './character-dice-format.util'

describe('character-dice-format.util (純粋関数)', () => {
  describe('getResultEmoji', () => {
    it('critical フラグでクリティカル絵文字を返す', () => {
      expect(getResultEmoji({ critical: true }, 50)).toBe('🌟 ')
    })

    it('result < 5 でクリティカル絵文字を返す（critical 未指定でも）', () => {
      expect(getResultEmoji({}, 4)).toBe('🌟 ')
    })

    it('fumble フラグでファンブル絵文字を返す', () => {
      expect(getResultEmoji({ fumble: true }, 50)).toBe('💥')
    })

    it('result > 95 でファンブル絵文字を返す', () => {
      expect(getResultEmoji({}, 96)).toBe('💥')
    })

    it('success フラグで成功絵文字を返す', () => {
      expect(getResultEmoji({ success: true }, 50)).toBe('✅')
    })

    it('failure フラグで失敗絵文字を返す', () => {
      expect(getResultEmoji({ failure: true }, 50)).toBe('❌')
    })

    it('該当なしで通常ロール絵文字を返す', () => {
      expect(getResultEmoji({}, 50)).toBe('🎲')
    })

    it('critical は fumble より優先される', () => {
      expect(getResultEmoji({ critical: true, fumble: true }, 50)).toBe('🌟 ')
    })
  })

  describe('formatResultText', () => {
    it('スキル名ありはスキルロール表記になる', () => {
      const text = formatResultText('✅', 'キャラA', '目星', '1d100 → 45')
      expect(text).toBe('✅**キャラA** の **目星** ロール：1d100 → 45')
    })

    it('スキル名 null は通常表記になる', () => {
      const text = formatResultText('🎲', 'キャラA', null, '1d100 → 45')
      expect(text).toBe('🎲**キャラA**：1d100 → 45')
    })
  })

  describe('getSuccessText', () => {
    it('boolean true → 成功', () => {
      expect(getSuccessText(true)).toBe('成功')
    })

    it('boolean false → 失敗', () => {
      expect(getSuccessText(false)).toBe('失敗')
    })

    it.each([
      [1, '成功'],
      [2, 'ハード成功'],
      [3, 'イクストリーム成功'],
      [4, 'クリティカル'],
      [-1, '失敗'],
      [-2, 'ファンブル']
    ])('number %i → %s', (input, expected) => {
      expect(getSuccessText(input)).toBe(expected)
    })

    it('未知の number → 不明', () => {
      expect(getSuccessText(99)).toBe('不明')
    })
  })

  describe('formatDiceRollResultAsText', () => {
    it('キャラクター名・ダイス・結果を含む', () => {
      const text = formatDiceRollResultAsText(
        { result: 45, success: undefined },
        { channelId: 'c', diceType: '1d100', notation: '1d100', characterName: 'キャラA' }
      )
      expect(text).toContain('🎲 **ダイスロール結果**')
      expect(text).toContain('**キャラクター**: キャラA')
      expect(text).toContain('**ダイス**: 1d100')
      expect(text).toContain('**結果**: 45')
    })

    it('skillName と targetValue を含む', () => {
      const text = formatDiceRollResultAsText(
        { result: 30, success: true },
        {
          channelId: 'c',
          diceType: '1d100',
          notation: '1d100',
          characterName: 'キャラA',
          skillName: '目星',
          targetValue: '60'
        }
      )
      expect(text).toContain('**スキル**: 目星 (目標値: 60)')
      expect(text).toContain('**判定**: 成功')
    })

    it('success が undefined のとき判定行を含めない', () => {
      const text = formatDiceRollResultAsText(
        { result: 45, success: undefined },
        { channelId: 'c', diceType: '1d100', notation: '1d100' }
      )
      expect(text).not.toContain('**判定**')
    })

    it('characterName 未指定のときキャラクター行を含めない', () => {
      const text = formatDiceRollResultAsText({ result: 10 }, { channelId: 'c', diceType: '1d100', notation: '1d100' })
      expect(text).not.toContain('**キャラクター**')
    })
  })
})
