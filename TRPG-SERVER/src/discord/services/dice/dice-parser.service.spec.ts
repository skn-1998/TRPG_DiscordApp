import { Character } from 'src/domains/character/models/character.model'
import { AttributeValue } from 'src/core/types/attribute.types'
import { DiceParserService } from './dice-parser.service'

/** values.base に数値を持つ最小の AttributeValue を作る */
const attr = (value: number): AttributeValue => ({ values: { base: value } })

/** parameter / skill のみを持つ最小 Character を作る */
const makeCharacter = (overrides: {
  parameter?: Record<string, AttributeValue>
  skill?: Record<string, AttributeValue>
}): Character =>
  ({
    parameter: overrides.parameter,
    skill: overrides.skill
  }) as Character

describe('DiceParserService', () => {
  let service: DiceParserService

  beforeEach(() => {
    service = new DiceParserService()
  })

  describe('parseFormula', () => {
    it('数値のみの式は小文字化・trimされ isValid:true を返す', () => {
      // Arrange / Act
      // 注: 最終検証 validateProcessedFormula は数値・演算子・括弧のみ許可するため、
      //     'd' を含むダイス記法(1d6 等)はこのパーサ単体では無効になる。
      const result = service.parseFormula('  12+2  ')

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.processedFormula).toBe('12+2')
      expect(result.characterUsed).toBe(false)
      expect(result.originalFormula).toBe('  12+2  ')
    })

    it('英語パラメータ(STR)をキャラクター値に置換する', () => {
      // Arrange
      const character = makeCharacter({ parameter: { STR: attr(15) } })

      // Act
      const result = service.parseFormula('STR+5', character)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.processedFormula).toBe('15+5')
      expect(result.characterUsed).toBe(true)
      expect(result.description).toContain('STR(15)')
    })

    it('日本語パラメータ(筋力)は単語境界(\\b)が効かず置換されない（既知の挙動）', () => {
      // Arrange
      // 注: substituteCharacterValues は new RegExp(`\\b${key}\\b`) で置換するが、
      //     \b は \w 境界のため日本語文字には成立しない。結果、日本語パラメータ単体は
      //     置換されず、許可外文字が残り最終検証で無効になる。本体未変更のため実挙動を記録。
      const character = makeCharacter({ parameter: { STR: attr(12) } })

      // Act
      const result = service.parseFormula('筋力', character)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('処理後の数式が無効です')
    })

    it('技能(dodge)を skill から置換する', () => {
      // Arrange
      const character = makeCharacter({ skill: { dodge: attr(40) } })

      // Act
      const result = service.parseFormula('dodge', character)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.processedFormula).toBe('40')
      expect(result.characterUsed).toBe(true)
    })

    it('該当パラメータが存在しない場合は 0 に置換する', () => {
      // Arrange
      const character = makeCharacter({ parameter: {} })

      // Act
      const result = service.parseFormula('STR', character)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.processedFormula).toBe('0')
      expect(result.characterUsed).toBe(true)
    })

    it('乗数(multiplier)を適用すると括弧付きの乗算式になる', () => {
      // Act
      const result = service.parseFormula('10', undefined, 3, 0)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.processedFormula).toBe('(10) * 3')
      expect(result.description).toContain('× 3')
    })

    it('正の修正値(modifier)を適用すると加算式になる', () => {
      // Act
      const result = service.parseFormula('10', undefined, 1, 5)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.processedFormula).toBe('(10) + 5')
      expect(result.description).toContain('+5')
    })

    it('負の修正値(modifier)を適用すると減算式になる', () => {
      // Act
      const result = service.parseFormula('10', undefined, 1, -3)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.processedFormula).toBe('(10)  -3')
      expect(result.description).toContain('-3')
    })

    it('乗数と修正値を同時に適用すると入れ子の式になる', () => {
      // Act
      const result = service.parseFormula('10', undefined, 2, 4)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.processedFormula).toBe('((10) * 2) + 4')
    })

    it('危険な文字列(eval()を含む)は isValid:false を返す', () => {
      // Act
      const result = service.parseFormula('eval(1+1)')

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('無効な数式です')
    })

    it('空文字は isValid:false を返す', () => {
      // Act
      const result = service.parseFormula('   ')

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('無効な数式です')
    })

    it('100文字を超える数式は isValid:false を返す', () => {
      // Arrange
      const longFormula = '1+'.repeat(60) // 120文字 > 100

      // Act
      const result = service.parseFormula(longFormula)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('無効な数式です')
    })

    it('処理後に許可外の文字が残ると isValid:false を返す', () => {
      // Arrange: キャラ値で置換されない英字はそのまま残り、最終検証で弾かれる
      // Act
      const result = service.parseFormula('xyz')

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('処理後の数式が無効です')
    })

    it('解析中に例外が発生した場合は errorMessage を返す', () => {
      // Arrange: getDisplayNumber が呼ばれる箇所で例外を誘発するため不正な parameter を渡す
      const brokenCharacter = {
        parameter: {
          STR: {
            // values の getter が例外を投げる
            get values() {
              throw new Error('boom')
            }
          }
        }
      } as unknown as Character

      // Act
      const result = service.parseFormula('STR', brokenCharacter)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('解析エラー')
      expect(result.errorMessage).toContain('boom')
    })

    describe('ダメージボーナス(db)境界', () => {
      it('STR+SIZ=12 のとき db は -2', () => {
        // Arrange
        const character = makeCharacter({ parameter: { STR: attr(6), SIZ: attr(6) } })

        // Act
        const result = service.parseFormula('db', character)

        // Assert
        expect(result.isValid).toBe(true)
        expect(result.processedFormula).toBe('-2')
      })

      it('STR+SIZ=13 のとき db は -1', () => {
        // Arrange
        const character = makeCharacter({ parameter: { STR: attr(7), SIZ: attr(6) } })

        // Act
        const result = service.parseFormula('db', character)

        // Assert
        expect(result.isValid).toBe(true)
        expect(result.processedFormula).toBe('-1')
      })
    })
  })

  describe('evaluateFormula', () => {
    it('正常な数式を計算し四捨五入する', () => {
      // Act / Assert
      expect(service.evaluateFormula('1+2*3')).toBe(7)
      expect(service.evaluateFormula('10/4')).toBe(3) // 2.5 → Math.round → 3
    })

    it('小数結果を四捨五入する', () => {
      // 7/2 = 3.5 → 4
      expect(service.evaluateFormula('7/2')).toBe(4)
    })

    it('不正な文字を含む数式は 1 を返す', () => {
      // Act / Assert
      expect(service.evaluateFormula('1+a')).toBe(1)
    })

    it('結果が負の値(範囲外)の場合は 1 を返す', () => {
      // Act / Assert
      expect(service.evaluateFormula('0-5')).toBe(1)
    })

    it('結果が 10000 を超える(範囲外)場合は 1 を返す', () => {
      // Act / Assert
      expect(service.evaluateFormula('10001')).toBe(1)
    })

    it('結果が非有限(0除算)の場合は 1 を返す', () => {
      // Act / Assert: 1/0 = Infinity
      expect(service.evaluateFormula('1/0')).toBe(1)
    })
  })

  describe('convertToDiceNotation', () => {
    it('0以下は 1b10 に変換する', () => {
      expect(service.convertToDiceNotation(0)).toBe('1b10')
      expect(service.convertToDiceNotation(-5)).toBe('1b10')
    })

    it('100超は 100b10 に変換する', () => {
      expect(service.convertToDiceNotation(101)).toBe('100b10')
    })

    it('通常値は Nb10 に変換する', () => {
      expect(service.convertToDiceNotation(50)).toBe('50b10')
      expect(service.convertToDiceNotation(100)).toBe('100b10')
      expect(service.convertToDiceNotation(1)).toBe('1b10')
    })
  })
})
