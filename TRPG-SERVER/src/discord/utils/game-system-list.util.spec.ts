import { parseGameSystemList } from './game-system-list.util'

describe('parseGameSystemList', () => {
  it('正常な配列をそのまま返す', () => {
    const input = [{ ID: 'cthulhu', NAME: 'クトゥルフ', SORT_KEY: 'く', HELP_MESSAGE: 'ヘルプ' }]

    expect(parseGameSystemList(input)).toBe(input)
  })

  it('配列でない場合は throw する', () => {
    expect(() => parseGameSystemList({})).toThrow(/構造が不正/)
  })

  it('要素が null の場合は throw する', () => {
    expect(() => parseGameSystemList([null])).toThrow(/構造が不正/)
  })

  it('空配列の場合は throw する', () => {
    expect(() => parseGameSystemList([])).toThrow(/構造が不正/)
  })

  it('必須キーが欠けている場合は throw する', () => {
    const input = [{ ID: 'cthulhu', NAME: 'クトゥルフ', SORT_KEY: 'く' }]

    expect(() => parseGameSystemList(input)).toThrow(/構造が不正/)
  })

  it('必須キーが文字列でない場合は throw する', () => {
    const input = [{ ID: 1, NAME: 'クトゥルフ', SORT_KEY: 'く', HELP_MESSAGE: 'ヘルプ' }]

    expect(() => parseGameSystemList(input)).toThrow(/構造が不正/)
  })
})
