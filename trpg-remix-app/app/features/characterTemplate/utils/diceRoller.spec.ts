// B4 で旧 front roller 本体と同時に削除する characterization spec。
import { parseDiceFormula, rollDice, rollMultipleDice, validateDiceFormula } from './diceRoller'

describe('legacy diceRoller characterization', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each(['[d6]', '[2d6+1d4]', '[1d6+1d6+2]', '[10]'])('%s は null を返して実行しない', (formula) => {
    expect(rollDice(formula)).toBeNull()
  })

  it('[2d6+1] はロール結果を返す', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(rollDice('[2d6+1]')).toEqual({
      formula: '[2d6+1]',
      rolls: [4, 4],
      modifier: 1,
      total: 9
    })
  })

  describe('validateDiceFormula', () => {
    it.each([['[3d6]'], ['[1d100]'], ['[2d6+6]'], ['[2d6-1]'], ['[3D6]'], [' [3d6] '], ['[1d2]'], ['[100d10000]']])(
      '%s は valid=true を返す',
      (formula) => {
        expect(validateDiceFormula(formula)).toEqual({ valid: true })
      }
    )

    it.each([[''], ['   ']])('%s は空エラーを返す', (formula) => {
      expect(validateDiceFormula(formula)).toEqual({
        valid: false,
        error: 'ダイス式が空です'
      })
    })

    it.each([['3d6'], ['[d6]'], ['[3d]'], ['[2d6+1d4]'], ['[10]'], ['[3d6]extra'], ['[3d6+]']])(
      '%s は形式エラーを返す',
      (formula) => {
        expect(validateDiceFormula(formula)).toEqual({
          valid: false,
          error: 'ダイス式の形式が正しくありません（例: [3d6], [1d100], [2d6+6]）'
        })
      }
    )

    it.each([['[0d6]'], ['[101d6]']])('%s は個数レンジエラーを返す', (formula) => {
      expect(validateDiceFormula(formula)).toEqual({
        valid: false,
        error: 'ダイスの個数は1～100の範囲で指定してください'
      })
    })

    it.each([['[1d0]'], ['[1d1]'], ['[1d10001]']])('%s は面数レンジエラーを返す', (formula) => {
      expect(validateDiceFormula(formula)).toEqual({
        valid: false,
        error: 'ダイスの面数は2～10000の範囲で指定してください'
      })
    })

    it('個数エラーは面数エラーより先に返る', () => {
      expect(validateDiceFormula('[0d1]')).toEqual({
        valid: false,
        error: 'ダイスの個数は1～100の範囲で指定してください'
      })
    })
  })

  describe('parseDiceFormula', () => {
    it.each([
      ['[3d6]', { count: 3, sides: 6, modifier: 0 }],
      ['[1d100]', { count: 1, sides: 100, modifier: 0 }],
      ['[2d6+6]', { count: 2, sides: 6, modifier: 6 }],
      ['[2d6-1]', { count: 2, sides: 6, modifier: -1 }],
      ['[2d6+0]', { count: 2, sides: 6, modifier: 0 }],
      ['[3D6]', { count: 3, sides: 6, modifier: 0 }],
      [' [3d6] ', { count: 3, sides: 6, modifier: 0 }]
    ])('%s を分解する', (formula, expected) => {
      expect(parseDiceFormula(formula)).toEqual(expected)
    })

    it.each([
      ['[0d6]', { count: 0, sides: 6, modifier: 0 }],
      ['[999d99999]', { count: 999, sides: 99999, modifier: 0 }]
    ])('%s は validateDiceFormula のレンジ制限を適用せず分解する', (formula, expected) => {
      expect(parseDiceFormula(formula)).toEqual(expected)
    })

    it.each([[''], ['   '], ['3d6'], ['[d6]'], ['[3d]'], ['[2d6+1d4]'], ['[10]'], ['[3d6]extra']])(
      '%s は null を返す',
      (formula) => {
        expect(parseDiceFormula(formula)).toBeNull()
      }
    )
  })

  describe('rollMultipleDice', () => {
    it('複数式をまとめて振り、式をキーにした Map を返す', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5)

      const results = rollMultipleDice(['[2d6+1]', '[1d100]'])

      expect(results.size).toBe(2)
      expect(results.get('[2d6+1]')).toEqual({
        formula: '[2d6+1]',
        rolls: [4, 4],
        modifier: 1,
        total: 9
      })
      expect(results.get('[1d100]')).toEqual({
        formula: '[1d100]',
        rolls: [51],
        modifier: 0,
        total: 51
      })
    })

    it('不正な式は Map に載せず、有効な式だけを残す', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5)

      const results = rollMultipleDice(['[3d6]', '3d6', '[d6]', ''])

      expect(results.size).toBe(1)
      expect([...results.keys()]).toEqual(['[3d6]'])
      expect(results.get('[3d6]')).toEqual({
        formula: '[3d6]',
        rolls: [4, 4, 4],
        modifier: 0,
        total: 12
      })
    })

    it('空配列では空の Map を返す', () => {
      const results = rollMultipleDice([])

      expect(results.size).toBe(0)
    })

    it('同じ式を複数回渡すと Map のキーが衝突して 1 件になる', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5)

      const results = rollMultipleDice(['[1d6]', '[1d6]'])

      expect(results.size).toBe(1)
      expect(results.get('[1d6]')).toEqual({
        formula: '[1d6]',
        rolls: [4],
        modifier: 0,
        total: 4
      })
    })

    it('validateDiceFormula のレンジ外の式もそのまま実行される', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5)

      const results = rollMultipleDice(['[0d6]'])

      expect(results.size).toBe(1)
      expect(results.get('[0d6]')).toEqual({
        formula: '[0d6]',
        rolls: [],
        modifier: 0,
        total: 0
      })
    })

    it('trim 前の式がそのまま Map のキーになる', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5)

      const results = rollMultipleDice([' [1d6] '])

      expect([...results.keys()]).toEqual([' [1d6] '])
      expect(results.get(' [1d6] ')).toEqual({
        formula: ' [1d6] ',
        rolls: [4],
        modifier: 0,
        total: 4
      })
    })
  })
})
