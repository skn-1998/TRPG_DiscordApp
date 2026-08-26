import { isPartsRecordValue, type SheetField } from '@trpg/sheet-engine'
import { isPartsValue, isResourceField, partsTotal, sheetValuesEqual } from './sheet-values.util'

describe('sheet-values.util', () => {
  describe('isPartsValue', () => {
    it('parts recordだけをparts値として扱う', () => {
      expect(isPartsValue({ parts: { base: 5, other: -1 } })).toBe(true)
      expect(isPartsValue({ parts: {} })).toBe(true)
    })

    it.each([null, [], {}, { parts: null }, { parts: [] }])('parts recordでない値を拒否する: %p', (value) => {
      expect(isPartsValue(value)).toBe(false)
    })

    it.each([
      [{ parts: { base: 1 } }, true],
      [{ parts: {} }, true],
      [{ parts: { base: 'not-checked-here' } }, true],
      [{ parts: new Date(0) }, true],
      [null, false],
      [[], false],
      [{}, false],
      [{ parts: null }, false],
      [{ parts: [] }, false]
    ] as const)('engine 正本が旧 server 厳格形の真理値を維持する: %p', (value, legacyExpected) => {
      expect(isPartsRecordValue(value)).toBe(legacyExpected)
      expect(isPartsValue(value)).toBe(legacyExpected)
    })
  })

  it('partsの全要素を合算する', () => {
    expect(partsTotal({ parts: { base: 5, buff: 2, temp: -1, other: 0.5 } })).toBe(6.5)
  })

  it.each([
    [{ type: 'track', role: { kind: 'resource', deltas: [-1, 1] } }, true],
    [{ type: 'scalar', valueType: 'number', parts: true, role: { kind: 'resource', deltas: [-1, 1] } }, true],
    [{ type: 'scalar', valueType: 'text', parts: true, role: { kind: 'resource', deltas: [-1, 1] } }, false],
    [{ type: 'scalar', valueType: 'number', parts: true }, false]
  ] as const)('resource palette対象をmaterializerと同じ条件で判定する: %p', (shape, expected) => {
    expect(isResourceField(shape as SheetField)).toBe(expected)
  })

  it('object key順に依存せず再帰的に等値比較する', () => {
    expect(
      sheetValuesEqual(
        { parts: { base: 5, other: 1 }, nested: ['a', { enabled: true }] },
        { nested: ['a', { enabled: true }], parts: { other: 1, base: 5 } }
      )
    ).toBe(true)
  })

  it('partsの表現差と欠損keyを区別する', () => {
    expect(sheetValuesEqual({ parts: { base: 12 } }, { parts: { base: 6, other: 6 } })).toBe(false)
    expect(sheetValuesEqual({ parts: { base: 12 } }, { parts: { base: 12, other: 0 } })).toBe(false)
  })
})
