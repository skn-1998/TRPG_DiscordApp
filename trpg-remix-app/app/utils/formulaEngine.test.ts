import { 
  rollDice, 
  evaluateDiceInFormula, 
  resolveCellReferences, 
  evaluateFormula,
  calculateCellValue,
  calculateAllCellValues,
  hasCircularReference
} from './formulaEngine'
import { CellData, CellReference } from '~/types/characterSheet'

describe('formulaEngine', () => {
  describe('rollDice', () => {
    it('should return a number between min and max', () => {
      const result = rollDice(1, 6)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(6)
    })

    it('should return sum of multiple dice', () => {
      const result = rollDice(3, 6)
      expect(result).toBeGreaterThanOrEqual(3)
      expect(result).toBeLessThanOrEqual(18)
    })
  })

  describe('evaluateDiceInFormula', () => {
    it('should replace dice notation with numbers', () => {
      const result = evaluateDiceInFormula('1d6')
      expect(result).toMatch(/^\d+$/)
    })

    it('should handle multiple dice in formula', () => {
      const result = evaluateDiceInFormula('1d6+2d10')
      expect(result).toMatch(/^\d+\+\d+$/)
    })

    it('should handle complex formulas with dice', () => {
      const result = evaluateDiceInFormula('(1d6+2)*3')
      expect(result).toMatch(/^\(\d+\+2\)\*3$/)
    })
  })

  describe('resolveCellReferences', () => {
    const cellReferences: Record<string, CellReference> = {
      'STR': { cellId: 'str_cell', cellName: 'STR', value: 15 },
      'CON': { cellId: 'con_cell', cellName: 'CON', value: 12 },
      'SIZ': { cellId: 'siz_cell', cellName: 'SIZ', value: 13 }
    }

    it('should resolve single cell reference', () => {
      const result = resolveCellReferences('[STR]', cellReferences)
      expect(result).toBe('15')
    })

    it('should resolve multiple cell references', () => {
      const result = resolveCellReferences('[STR]+[CON]', cellReferences)
      expect(result).toBe('15+12')
    })

    it('should handle complex formulas with references', () => {
      const result = resolveCellReferences('([CON]+[SIZ])/10', cellReferences)
      expect(result).toBe('(12+13)/10')
    })

    it('should replace unknown references with 0', () => {
      const result = resolveCellReferences('[UNKNOWN]', cellReferences)
      expect(result).toBe('0')
    })
  })

  describe('evaluateFormula', () => {
    it('should evaluate basic arithmetic', () => {
      expect(evaluateFormula('5+3')).toBe(8)
      expect(evaluateFormula('10-4')).toBe(6)
      expect(evaluateFormula('6*7')).toBe(42)
      expect(evaluateFormula('15/3')).toBe(5)
    })

    it('should handle parentheses', () => {
      expect(evaluateFormula('(5+3)*2')).toBe(16)
      expect(evaluateFormula('10/(2+3)')).toBe(2)
    })

    it('should handle decimal numbers', () => {
      expect(evaluateFormula('2.5*4')).toBe(10)
      expect(evaluateFormula('7/2')).toBe(3.5)
    })

    it('should return 0 for invalid formulas', () => {
      expect(evaluateFormula('invalid')).toBe(0)
    })
  })

  describe('calculateCellValue', () => {
    const cellReferences: Record<string, CellReference> = {
      'STR': { cellId: 'str_cell', cellName: 'STR', value: 15 },
      'CON': { cellId: 'con_cell', cellName: 'CON', value: 12 },
      'SIZ': { cellId: 'siz_cell', cellName: 'SIZ', value: 13 }
    }

    it('should calculate simple values', () => {
      const cell: CellData = {
        id: 'test_cell',
        name: 'TEST',
        value: '10',
        type: 'number',
        row: 0,
        col: 0
      }
      expect(calculateCellValue(cell, cellReferences)).toBe(10)
    })

    it('should calculate formulas with references', () => {
      const cell: CellData = {
        id: 'hp_cell',
        name: 'HP',
        value: '([CON]+[SIZ])/10',
        type: 'calculated',
        row: 0,
        col: 0
      }
      expect(calculateCellValue(cell, cellReferences)).toBe(2.5)
    })

    it('should handle text values', () => {
      const cell: CellData = {
        id: 'name_cell',
        name: 'NAME',
        value: 'Test Character',
        type: 'text',
        row: 0,
        col: 0
      }
      expect(calculateCellValue(cell, cellReferences)).toBe('Test Character')
    })

    it('should handle empty values', () => {
      const cell: CellData = {
        id: 'empty_cell',
        name: 'EMPTY',
        value: '',
        type: 'text',
        row: 0,
        col: 0
      }
      expect(calculateCellValue(cell, cellReferences)).toBe('')
    })
  })

  describe('calculateAllCellValues', () => {
    it('should calculate all cell values', () => {
      const cells: CellData[] = [
        {
          id: 'str_cell',
          name: 'STR',
          value: '15',
          type: 'stat',
          row: 0,
          col: 0
        },
        {
          id: 'con_cell',
          name: 'CON',
          value: '12',
          type: 'stat',
          row: 0,
          col: 1
        },
        {
          id: 'hp_cell',
          name: 'HP',
          value: '([STR]+[CON])/2',
          type: 'calculated',
          row: 1,
          col: 0
        }
      ]

      const results = calculateAllCellValues(cells)
      expect(results['str_cell']).toBe(15)
      expect(results['con_cell']).toBe(12)
      expect(results['hp_cell']).toBe(13.5)
    })
  })

  describe('hasCircularReference', () => {
    it('should detect circular references', () => {
      const cells: CellData[] = [
        {
          id: 'a_cell',
          name: 'A',
          value: '[B]',
          type: 'calculated',
          row: 0,
          col: 0
        },
        {
          id: 'b_cell',
          name: 'B',
          value: '[A]',
          type: 'calculated',
          row: 0,
          col: 1
        }
      ]

      expect(hasCircularReference(cells)).toBe(true)
    })

    it('should not detect circular references when there are none', () => {
      const cells: CellData[] = [
        {
          id: 'a_cell',
          name: 'A',
          value: '10',
          type: 'stat',
          row: 0,
          col: 0
        },
        {
          id: 'b_cell',
          name: 'B',
          value: '[A]*2',
          type: 'calculated',
          row: 0,
          col: 1
        }
      ]

      expect(hasCircularReference(cells)).toBe(false)
    })

    it('should detect complex circular references', () => {
      const cells: CellData[] = [
        {
          id: 'a_cell',
          name: 'A',
          value: '[B]',
          type: 'calculated',
          row: 0,
          col: 0
        },
        {
          id: 'b_cell',
          name: 'B',
          value: '[C]',
          type: 'calculated',
          row: 0,
          col: 1
        },
        {
          id: 'c_cell',
          name: 'C',
          value: '[A]',
          type: 'calculated',
          row: 0,
          col: 2
        }
      ]

      expect(hasCircularReference(cells)).toBe(true)
    })
  })
})

// 使用例のテスト
describe('TRPG Character Sheet Examples', () => {
  describe('Cthulhu Mythos TRPG', () => {
    it('should calculate character stats correctly', () => {
      const cells: CellData[] = [
        {
          id: 'str_cell',
          name: 'STR',
          value: '65',
          type: 'stat',
          row: 0,
          col: 0
        },
        {
          id: 'con_cell',
          name: 'CON',
          value: '70',
          type: 'stat',
          row: 0,
          col: 1
        },
        {
          id: 'siz_cell',
          name: 'SIZ',
          value: '60',
          type: 'stat',
          row: 0,
          col: 2
        },
        {
          id: 'pow_cell',
          name: 'POW',
          value: '55',
          type: 'stat',
          row: 1,
          col: 0
        },
        {
          id: 'hp_cell',
          name: 'HP',
          value: '([CON]+[SIZ])/10',
          type: 'calculated',
          row: 2,
          col: 0
        },
        {
          id: 'mp_cell',
          name: 'MP',
          value: '[POW]/5',
          type: 'calculated',
          row: 2,
          col: 1
        },
        {
          id: 'san_cell',
          name: 'SAN',
          value: '[POW]',
          type: 'calculated',
          row: 2,
          col: 2
        }
      ]

      const results = calculateAllCellValues(cells)
      expect(results['hp_cell']).toBe(13) // (70+60)/10
      expect(results['mp_cell']).toBe(11) // 55/5
      expect(results['san_cell']).toBe(55) // 55
    })
  })
})