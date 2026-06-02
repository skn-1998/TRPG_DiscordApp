import { rollDice, parseDiceNotation } from './dice.util'

describe('dice.util', () => {
  describe('rollDice', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('Math.randomを固定すると各出目が floor(random*faces)+1 で決定化される', () => {
      // Arrange: random=0.5 → floor(0.5*6)+1 = 4 が3回
      jest.spyOn(Math, 'random').mockReturnValue(0.5)

      // Act
      const result = rollDice(3, 6)

      // Assert
      expect(result.rolls).toEqual([4, 4, 4])
      expect(result.total).toBe(12)
      expect(result.diceType).toBe('3d6')
    })

    it('random=0 のとき最小値1が出る（下限境界）', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0)

      const result = rollDice(2, 6)

      expect(result.rolls).toEqual([1, 1])
      expect(result.total).toBe(2)
    })

    it('random が1未満の最大付近のとき最大値（faces）が出る（上限境界）', () => {
      // floor(0.999...*6)+1 = floor(5.99..)+1 = 6
      jest.spyOn(Math, 'random').mockReturnValue(0.999999)

      const result = rollDice(1, 6)

      expect(result.rolls).toEqual([6])
      expect(result.total).toBe(6)
    })

    it('呼び出しごとに異なる random 値を順に消費する', () => {
      // 1回目→1, 2回目→6 (1d6)
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0) // floor(0*6)+1 = 1
        .mockReturnValueOnce(0.9) // floor(5.4)+1 = 6

      const result = rollDice(2, 6)

      expect(result.rolls).toEqual([1, 6])
      expect(result.total).toBe(7)
    })

    it('diceCount=0 のとき rolls は空で total は0（境界値）', () => {
      const randomSpy = jest.spyOn(Math, 'random')

      const result = rollDice(0, 6)

      expect(result.rolls).toEqual([])
      expect(result.total).toBe(0)
      expect(result.diceType).toBe('0d6')
      // ロールしないので random も呼ばれない
      expect(randomSpy).not.toHaveBeenCalled()
    })

    it('出目の合計が rolls の総和と一致する', () => {
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.1) // floor(0.1*100)+1 = 11
        .mockReturnValueOnce(0.5) // floor(0.5*100)+1 = 51

      const result = rollDice(2, 100)

      expect(result.rolls).toEqual([11, 51])
      expect(result.total).toBe(result.rolls!.reduce((a, b) => a + b, 0))
    })

    it('diceType は `<count>d<faces>` 形式で組み立てられる', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0)

      expect(rollDice(2, 6).diceType).toBe('2d6')
      expect(rollDice(1, 20).diceType).toBe('1d20')
    })
  })

  describe('parseDiceNotation', () => {
    it('代表的な記法 2d6 を [count, faces] に解析する', () => {
      expect(parseDiceNotation('2d6')).toEqual([2, 6])
    })

    it('大文字のDを含む記法も解析する（大文字小文字を無視）', () => {
      expect(parseDiceNotation('1D100')).toEqual([1, 100])
    })

    it('複数桁の数値を解析する', () => {
      expect(parseDiceNotation('10d20')).toEqual([10, 20])
    })

    it('ダイス表記でない文字列には null を返す', () => {
      expect(parseDiceNotation('abc')).toBeNull()
    })

    it('空文字には null を返す', () => {
      expect(parseDiceNotation('')).toBeNull()
    })

    it('前後に余分な文字がある記法には null を返す（完全一致のみ許可）', () => {
      expect(parseDiceNotation('2d6+1')).toBeNull()
      expect(parseDiceNotation(' 2d6')).toBeNull()
      expect(parseDiceNotation('x2d6')).toBeNull()
    })

    it('区切り文字 d が無い記法には null を返す', () => {
      expect(parseDiceNotation('26')).toBeNull()
    })

    it('ダイス数が0の場合は null を返す（下限境界）', () => {
      expect(parseDiceNotation('0d6')).toBeNull()
    })

    it('面数が0の場合は null を返す（下限境界）', () => {
      expect(parseDiceNotation('2d0')).toBeNull()
    })

    it('両方が0の場合は null を返す', () => {
      expect(parseDiceNotation('0d0')).toBeNull()
    })

    it('ダイス数・面数が1の最小有効値を解析する', () => {
      expect(parseDiceNotation('1d1')).toEqual([1, 1])
    })
  })
})
