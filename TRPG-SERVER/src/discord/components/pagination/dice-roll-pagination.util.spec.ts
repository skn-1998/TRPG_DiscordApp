import { DiceRollText } from 'src/domains/dice-roll/models/dice-roll-text.model'
import { Character } from 'src/domains/character/models/character.model'
import {
  ALL_CHARACTERS,
  DEFAULT_HISTORY_TITLE,
  MAX_ROLL_LIMIT,
  clampPage,
  computeNewPage,
  filterRollsByCharacter,
  formatDiceRoll,
  isSpecificCharacter,
  limitRolls,
  resolveHistoryTitle,
  sortRollsByCreatedAtDesc
} from './dice-roll-pagination.util'

const makeRoll = (overrides: Partial<DiceRollText> = {}): DiceRollText =>
  ({
    characterId: 'char-1',
    text: '1d100 → 50',
    result: 50,
    diceRoll: '1d100',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    ...overrides
  }) as DiceRollText

describe('dice-roll-pagination.util', () => {
  describe('isSpecificCharacter', () => {
    it('returns false for undefined', () => {
      expect(isSpecificCharacter(undefined)).toBe(false)
    })

    it("returns false for 'all'", () => {
      expect(isSpecificCharacter(ALL_CHARACTERS)).toBe(false)
    })

    it('returns true for a concrete characterId', () => {
      expect(isSpecificCharacter('char-1')).toBe(true)
    })
  })

  describe('resolveHistoryTitle', () => {
    const characters: Character[] = [{ characterId: 'char-1', characterName: '探索者A' } as Character]

    it('returns default title when characterId is undefined', () => {
      expect(resolveHistoryTitle(undefined, characters)).toBe(DEFAULT_HISTORY_TITLE)
    })

    it("returns default title for 'all'", () => {
      expect(resolveHistoryTitle(ALL_CHARACTERS, characters)).toBe(DEFAULT_HISTORY_TITLE)
    })

    it('uses character name when found in cache', () => {
      expect(resolveHistoryTitle('char-1', characters)).toBe('探索者Aのダイスロール履歴')
    })

    it('falls back to characterId when not found', () => {
      expect(resolveHistoryTitle('char-x', characters)).toBe('char-xのダイスロール履歴')
    })

    it('falls back to characterId when characters cache is null', () => {
      expect(resolveHistoryTitle('char-1', null)).toBe('char-1のダイスロール履歴')
    })
  })

  describe('filterRollsByCharacter', () => {
    const rolls = [makeRoll({ characterId: 'char-1' }), makeRoll({ characterId: 'char-2' })]

    it('returns all rolls when characterId is undefined', () => {
      expect(filterRollsByCharacter(rolls, undefined)).toHaveLength(2)
    })

    it("returns all rolls for 'all'", () => {
      expect(filterRollsByCharacter(rolls, ALL_CHARACTERS)).toHaveLength(2)
    })

    it('filters by concrete characterId', () => {
      const result = filterRollsByCharacter(rolls, 'char-1')
      expect(result).toHaveLength(1)
      expect(result[0].characterId).toBe('char-1')
    })
  })

  describe('sortRollsByCreatedAtDesc', () => {
    it('sorts newest first without mutating input', () => {
      const older = makeRoll({ createdAt: new Date('2023-01-01T08:00:00.000Z') })
      const newer = makeRoll({ createdAt: new Date('2023-01-01T10:00:00.000Z') })
      const input = [older, newer]

      const result = sortRollsByCreatedAtDesc(input)

      expect(result[0]).toBe(newer)
      expect(result[1]).toBe(older)
      // 非破壊であること
      expect(input[0]).toBe(older)
    })

    it('treats missing createdAt as epoch (oldest)', () => {
      const withDate = makeRoll({ createdAt: new Date('2023-01-01T08:00:00.000Z') })
      const noDate = makeRoll({ createdAt: undefined })

      const result = sortRollsByCreatedAtDesc([noDate, withDate])

      expect(result[0]).toBe(withDate)
      expect(result[1]).toBe(noDate)
    })
  })

  describe('limitRolls', () => {
    it('limits to MAX_ROLL_LIMIT by default', () => {
      const rolls = Array.from({ length: MAX_ROLL_LIMIT + 50 }, () => makeRoll())
      expect(limitRolls(rolls)).toHaveLength(MAX_ROLL_LIMIT)
    })

    it('respects a custom limit', () => {
      const rolls = Array.from({ length: 10 }, () => makeRoll())
      expect(limitRolls(rolls, 3)).toHaveLength(3)
    })

    it('returns all when under the limit', () => {
      const rolls = Array.from({ length: 2 }, () => makeRoll())
      expect(limitRolls(rolls)).toHaveLength(2)
    })
  })

  describe('formatDiceRoll', () => {
    it('uses the text property when present', () => {
      const roll = makeRoll({ text: '✅ 成功', createdAt: new Date('2023-06-15T03:04:00.000Z') })
      const result = formatDiceRoll(roll)
      expect(result).toContain('✅ 成功')
      expect(result.endsWith('\n')).toBe(true)
      expect(result.startsWith('**')).toBe(true)
    })

    it('falls back to diceRoll → result when text is empty', () => {
      const roll = makeRoll({ text: '', diceRoll: '1d6', result: 4 })
      expect(formatDiceRoll(roll)).toContain('1d6 → 4')
    })
  })

  describe('computeNewPage', () => {
    it('decrements but clamps at 1 for prev', () => {
      expect(computeNewPage(2, 5, 'prev')).toBe(1)
      expect(computeNewPage(1, 5, 'prev')).toBe(1)
    })

    it('increments but clamps at totalPages for next', () => {
      expect(computeNewPage(2, 5, 'next')).toBe(3)
      expect(computeNewPage(5, 5, 'next')).toBe(5)
    })

    it('jumps to first', () => {
      expect(computeNewPage(4, 5, 'first')).toBe(1)
    })

    it('jumps to last', () => {
      expect(computeNewPage(2, 5, 'last')).toBe(5)
    })
  })

  describe('clampPage', () => {
    it('clamps below range to 1', () => {
      expect(clampPage(-1, 3)).toBe(1)
      expect(clampPage(0, 3)).toBe(1)
    })

    it('clamps above range to totalPages', () => {
      expect(clampPage(10, 3)).toBe(3)
    })

    it('keeps in-range values', () => {
      expect(clampPage(2, 3)).toBe(2)
    })
  })
})
