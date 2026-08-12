import { normalizeSheetVisibilityValue } from './character-sheet-read.mapper'

describe('normalizeSheetVisibilityValue', () => {
  it.each([
    { label: 'private', value: 'private', expected: 'private' },
    { label: 'public', value: 'public', expected: 'public' },
    { label: '予約値 unlisted', value: 'unlisted', expected: 'private' },
    { label: '欠落', value: undefined, expected: 'private' },
    { label: '数値', value: 42, expected: 'private' },
    { label: 'null', value: null, expected: 'private' },
    { label: 'object', value: {}, expected: 'private' }
  ] as const)('$label を $expected に正規化する', ({ value, expected }) => {
    expect(normalizeSheetVisibilityValue(value)).toBe(expected)
  })
})
