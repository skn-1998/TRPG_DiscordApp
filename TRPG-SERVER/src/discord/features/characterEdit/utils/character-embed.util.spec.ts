import {
  generateShortCharacterId,
  formatAttributeFieldValue,
  buildAttributeFields,
  buildFieldOptionDisplay,
  extractDiceRollValue
} from './character-embed.util'

describe('character-embed.util', () => {
  describe('generateShortCharacterId', () => {
    it('英小文字と数字のみの8文字を生成する', () => {
      const id = generateShortCharacterId()
      expect(id).toHaveLength(8)
      expect(id).toMatch(/^[a-z0-9]{8}$/)
    })

    it('複数回呼び出すと（ほぼ確実に）異なる値を生成する', () => {
      const ids = new Set(Array.from({ length: 20 }, () => generateShortCharacterId()))
      expect(ids.size).toBeGreaterThan(1)
    })
  })

  describe('formatAttributeFieldValue', () => {
    it('values の合計と内訳（0以外）を整形する', () => {
      const result = formatAttributeFieldValue({ values: { base: 10, buff: 5, zero: 0 } })
      expect(result).toBe('**合計:** 15\n(base: +10, buff: +5)')
    })

    it('負の値はそのまま符号付きで内訳に出す', () => {
      const result = formatAttributeFieldValue({ values: { base: 10, debuff: -3 } })
      expect(result).toBe('**合計:** 7\n(base: +10, debuff: -3)')
    })

    it('dice と description を付与する', () => {
      const result = formatAttributeFieldValue({
        values: { base: 1 },
        dice: '1d100',
        description: '説明文'
      })
      expect(result).toBe('**合計:** 1\n(base: +1)\n🎲 **ダイス:** 1d100\n💬 説明文')
    })

    it('内訳が全て0のとき合計のみ（内訳行なし）', () => {
      const result = formatAttributeFieldValue({ values: { base: 0 } })
      expect(result).toBe('**合計:** 0')
    })

    it('values が空の object は「値が設定されていません」', () => {
      expect(formatAttributeFieldValue({})).toBe('値が設定されていません')
    })

    it('プリミティブは String 化する', () => {
      expect(formatAttributeFieldValue(42)).toBe('42')
      expect(formatAttributeFieldValue('text')).toBe('text')
    })
  })

  describe('buildAttributeFields', () => {
    it('name を優先し inline:true のフィールド配列を返す', () => {
      const fields = buildAttributeFields({
        力: { name: 'STR', values: { base: 12 } },
        器用: { values: { base: 8 } }
      })
      expect(fields).toEqual([
        { name: 'STR', value: '**合計:** 12\n(base: +12)', inline: true },
        { name: '器用', value: '**合計:** 8\n(base: +8)', inline: true }
      ])
    })

    it('null/undefined の値はスキップする', () => {
      const fields = buildAttributeFields({
        a: null,
        b: undefined,
        c: { values: { base: 1 } }
      })
      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('c')
    })

    it('フィールド名は256文字、値は1024文字で切り詰める', () => {
      const longName = 'あ'.repeat(300)
      const longDesc = 'b'.repeat(2000)
      const fields = buildAttributeFields({
        [longName]: { description: longDesc }
      })
      expect(fields[0].name).toHaveLength(256)
      expect(fields[0].name.endsWith('...')).toBe(true)
      expect(fields[0].value).toHaveLength(1024)
      expect(fields[0].value.endsWith('...')).toBe(true)
    })
  })

  describe('buildFieldOptionDisplay', () => {
    it('AttributeValue形式: 合計・ダイス・説明を | 区切りで整形', () => {
      const result = buildFieldOptionDisplay('力', {
        name: 'STR',
        values: { base: 10, buff: 5 },
        dice: '1d100',
        description: '筋力'
      })
      expect(result).toEqual({ displayName: 'STR', displayValue: '合計: 15 | ダイス: 1d100 | 筋力' })
    })

    it('AttributeValue形式: values が空のとき「設定値なし」', () => {
      const result = buildFieldOptionDisplay('力', { values: {} })
      expect(result).toEqual({ displayName: '力', displayValue: '設定値なし' })
    })

    it('レガシー形式（name + value）を整形', () => {
      const result = buildFieldOptionDisplay('hp', { name: 'HP', value: 30 })
      expect(result).toEqual({ displayName: 'HP', displayValue: '30' })
    })

    it('その他のオブジェクトは「オブジェクト形式」', () => {
      const result = buildFieldOptionDisplay('misc', { foo: 'bar' })
      expect(result).toEqual({ displayName: 'misc', displayValue: 'オブジェクト形式' })
    })

    it('プリミティブはキーと String 化した値', () => {
      const result = buildFieldOptionDisplay('memo', 'hello')
      expect(result).toEqual({ displayName: 'memo', displayValue: 'hello' })
    })

    it('表示名・表示値を100文字で短縮する', () => {
      const result = buildFieldOptionDisplay('x'.repeat(150), 'y'.repeat(150))
      expect(result.displayName).toHaveLength(100)
      expect(result.displayName.endsWith('...')).toBe(true)
      expect(result.displayValue).toHaveLength(100)
      expect(result.displayValue.endsWith('...')).toBe(true)
    })
  })

  describe('extractDiceRollValue', () => {
    it('name と value を持つオブジェクトから抽出', () => {
      expect(extractDiceRollValue('k', { name: 'STR', value: 12 })).toEqual({ name: 'STR', rollValue: 12 })
    })

    it('name/value を持たないオブジェクトはキーと数値化', () => {
      expect(extractDiceRollValue('k', { foo: 1 })).toEqual({ name: 'k', rollValue: 0 })
    })

    it('プリミティブはキーと Number 化', () => {
      expect(extractDiceRollValue('hp', '15')).toEqual({ name: 'hp', rollValue: 15 })
      expect(extractDiceRollValue('hp', 'abc')).toEqual({ name: 'hp', rollValue: 0 })
    })
  })
})
