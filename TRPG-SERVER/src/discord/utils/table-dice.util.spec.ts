import { rollOnTable, TableEntry } from './table-dice.util'

describe('table-dice.util', () => {
  describe('rollOnTable', () => {
    // 1d6 を出目ごとに別の content にマッピングする代表的なテーブル
    const table: TableEntry[] = [
      { min: 1, max: 2, content: '低い' },
      { min: 3, max: 4, content: '普通' },
      { min: 5, max: 6, content: '高い' }
    ]

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('出目に対応するテーブル項目を返す（範囲内）', () => {
      // Arrange: random=0.5 → floor(0.5*6)+1 = 4 → min3..max4 の '普通'
      jest.spyOn(Math, 'random').mockReturnValue(0.5)

      // Act
      const result = rollOnTable(table, 1, 6)

      // Assert
      expect(result.tableEntry).toEqual({ min: 3, max: 4, content: '普通' })
      expect(result.diceResult.total).toBe(4)
      expect(result.diceResult.diceType).toBe('1d6')
    })

    it('出目が項目の最小値と一致するとき、その項目を選ぶ（下限境界・min は包含）', () => {
      // random=0 → floor(0*6)+1 = 1 → min1..max2 の '低い'
      jest.spyOn(Math, 'random').mockReturnValue(0)

      const result = rollOnTable(table, 1, 6)

      expect(result.diceResult.total).toBe(1)
      expect(result.tableEntry.content).toBe('低い')
    })

    it('出目が項目の最大値と一致するとき、その項目を選ぶ（上限境界・max は包含）', () => {
      // random=0.999999 → floor(5.99..)+1 = 6 → min5..max6 の '高い'
      jest.spyOn(Math, 'random').mockReturnValue(0.999999)

      const result = rollOnTable(table, 1, 6)

      expect(result.diceResult.total).toBe(6)
      expect(result.tableEntry.content).toBe('高い')
    })

    it('複数ダイスの合計値に対応する項目を選ぶ', () => {
      // 2d6, random=0.5 が2回 → (floor(3)+1)*2 = 8
      jest.spyOn(Math, 'random').mockReturnValue(0.5)
      const sumTable: TableEntry[] = [
        { min: 2, max: 6, content: '小' },
        { min: 7, max: 12, content: '大' }
      ]

      const result = rollOnTable(sumTable, 2, 6)

      expect(result.diceResult.total).toBe(8)
      expect(result.tableEntry.content).toBe('大')
    })

    it('出目に対応する項目が無い場合はエラーを投げる（隙間に落ちる）', () => {
      // random=0.5 → total=4 だが、テーブルに4をカバーする項目が無い
      jest.spyOn(Math, 'random').mockReturnValue(0.5)
      const gapTable: TableEntry[] = [
        { min: 1, max: 3, content: 'A' },
        { min: 5, max: 6, content: 'B' }
      ]

      expect(() => rollOnTable(gapTable, 1, 6)).toThrow('テーブルに 4 の結果に対応する項目がありません')
    })

    it('空のテーブルではエラーを投げる', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0)

      expect(() => rollOnTable([], 1, 6)).toThrow('テーブルに 1 の結果に対応する項目がありません')
    })

    it('範囲が重複する場合は最初に一致した項目を返す（find の仕様）', () => {
      // random=0 → total=1。1 は両方の項目に一致するが先頭が優先される
      jest.spyOn(Math, 'random').mockReturnValue(0)
      const overlapTable: TableEntry[] = [
        { min: 1, max: 6, content: '先頭' },
        { min: 1, max: 6, content: '後続' }
      ]

      const result = rollOnTable(overlapTable, 1, 6)

      expect(result.tableEntry.content).toBe('先頭')
    })
  })
})
