import {
  AttributeSection,
  AttributeValue,
  addDisplayValue,
  addDisplayValuesToSection,
  applyDiscordDelta,
  getDisplayNumber
} from './attribute.types'

describe('attribute.types', () => {
  describe('getDisplayNumber', () => {
    it('values が未定義なら 0 を返す', () => {
      expect(getDisplayNumber({})).toBe(0)
    })

    it('values が空オブジェクトなら 0 を返す', () => {
      expect(getDisplayNumber({ values: {} })).toBe(0)
    })

    it('単一の値をそのまま返す', () => {
      expect(getDisplayNumber({ values: { base: 10 } })).toBe(10)
    })

    it('複数の値を合算する', () => {
      const attr: AttributeValue = {
        values: { base: 10, fluctuation: 5, buff: 3, debuff: -2 }
      }
      expect(getDisplayNumber(attr)).toBe(16)
    })

    it('負値を含めて合算する', () => {
      expect(getDisplayNumber({ values: { base: -5, other: -10 } })).toBe(-15)
    })

    it('合計が 0 になるケースも正しく計算する', () => {
      expect(getDisplayNumber({ values: { base: 5, debuff: -5 } })).toBe(0)
    })

    it('number 以外の値は 0 として無視する', () => {
      // 型外の不正値が混入しても合算が壊れないことを保証
      const attr = {
        values: { base: 10, broken: 'x', nil: null, undef: undefined }
      } as unknown as AttributeValue
      expect(getDisplayNumber(attr)).toBe(10)
    })

    it('index など他のプロパティは合算に影響しない（values のみが対象）', () => {
      const attr: AttributeValue = { index: 99, values: { base: 7 } }
      expect(getDisplayNumber(attr)).toBe(7)
    })

    it('小数値も合算できる', () => {
      expect(getDisplayNumber({ values: { base: 1.5, buff: 2.25 } })).toBe(3.75)
    })
  })

  describe('applyDiscordDelta', () => {
    it('values が未定義の場合 other を delta で初期化する', () => {
      const result = applyDiscordDelta({}, 5)
      expect(result.values).toEqual({ other: 5 })
    })

    it('既存の other に delta を加算する', () => {
      const result = applyDiscordDelta({ values: { other: 10 } }, 3)
      expect(result.values).toEqual({ other: 13 })
    })

    it('other が未定義なら 0 起点で加算する（他キーは保持）', () => {
      const result = applyDiscordDelta({ values: { base: 20 } }, 7)
      expect(result.values).toEqual({ base: 20, other: 7 })
    })

    it('負の delta で減算できる', () => {
      const result = applyDiscordDelta({ values: { other: 10 } }, -4)
      expect(result.values).toEqual({ other: 6 })
    })

    it('delta が 0 のときは値を変えない', () => {
      const result = applyDiscordDelta({ values: { other: 8 } }, 0)
      expect(result.values).toEqual({ other: 8 })
    })

    it('other 以外の values キーは変更しない', () => {
      const result = applyDiscordDelta({ values: { base: 5, buff: 2, other: 1 } }, 3)
      expect(result.values).toEqual({ base: 5, buff: 2, other: 4 })
    })

    it('name や index など他のプロパティを保持する', () => {
      const attr: AttributeValue = { name: 'HP', index: 1, dice: '1d6', values: { other: 0 } }
      const result = applyDiscordDelta(attr, 2)
      expect(result.name).toBe('HP')
      expect(result.index).toBe(1)
      expect(result.dice).toBe('1d6')
      expect(result.values).toEqual({ other: 2 })
    })

    it('入力オブジェクトを破壊しない（非破壊）', () => {
      const attr: AttributeValue = { values: { other: 10 } }
      applyDiscordDelta(attr, 5)
      expect(attr.values).toEqual({ other: 10 })
    })

    it('入力の values オブジェクトも破壊しない', () => {
      const original = { base: 1, other: 2 }
      const attr: AttributeValue = { values: original }
      applyDiscordDelta(attr, 5)
      expect(original).toEqual({ base: 1, other: 2 })
    })
  })

  describe('addDisplayValue', () => {
    it('display に getDisplayNumber の結果を付与する', () => {
      const attr: AttributeValue = { values: { base: 10, buff: 5 } }
      const result = addDisplayValue(attr)
      expect(result.display).toBe(15)
    })

    it('values が未定義なら display は 0', () => {
      expect(addDisplayValue({}).display).toBe(0)
    })

    it('元のプロパティをすべて保持する', () => {
      const attr: AttributeValue = {
        name: 'STR',
        index: 2,
        description: '筋力',
        dice: '3d6',
        isVisible: true,
        values: { base: 12 }
      }
      const result = addDisplayValue(attr)
      expect(result).toMatchObject(attr)
      expect(result.display).toBe(12)
    })

    it('入力オブジェクトを破壊しない（display を生やさない）', () => {
      const attr: AttributeValue = { values: { base: 3 } }
      addDisplayValue(attr)
      expect('display' in attr).toBe(false)
    })
  })

  describe('addDisplayValuesToSection', () => {
    it('空セクションは空オブジェクトを返す', () => {
      expect(addDisplayValuesToSection({})).toEqual({})
    })

    it('各属性に display を付与する', () => {
      const section: AttributeSection = {
        hp: { values: { base: 10, buff: 2 } },
        mp: { values: { base: 5 } }
      }
      const result = addDisplayValuesToSection(section)
      expect(result.hp.display).toBe(12)
      expect(result.mp.display).toBe(5)
    })

    it('各属性の元プロパティを保持する', () => {
      const section: AttributeSection = {
        str: { name: '筋力', index: 1, values: { base: 13 } }
      }
      const result = addDisplayValuesToSection(section)
      expect(result.str).toMatchObject({ name: '筋力', index: 1, values: { base: 13 } })
      expect(result.str.display).toBe(13)
    })

    it('キーの集合を維持する', () => {
      const section: AttributeSection = {
        a: { values: { base: 1 } },
        b: { values: { base: 2 } },
        c: { values: { base: 3 } }
      }
      const result = addDisplayValuesToSection(section)
      expect(Object.keys(result)).toEqual(['a', 'b', 'c'])
    })

    it('入力セクションを破壊しない', () => {
      const section: AttributeSection = { hp: { values: { base: 10 } } }
      addDisplayValuesToSection(section)
      expect('display' in section.hp).toBe(false)
    })
  })
})
