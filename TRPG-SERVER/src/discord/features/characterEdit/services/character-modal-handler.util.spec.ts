/**
 * Unit tests for character-modal-handler.util (pure functions)
 */
import {
  parseEditCustomId,
  parseCreationCustomId,
  buildFieldData,
  buildAttributeValueFromForm,
  isValidAttributeValue,
  buildUpdateData,
  type BuiltAttributeValue
} from './character-modal-handler.util'

describe('character-modal-handler.util', () => {
  describe('parseEditCustomId', () => {
    it('セッション形式を解析する', () => {
      expect(parseEditCustomId('char-edit-modal-0001')).toEqual({
        kind: 'session',
        sessionId: '0001'
      })
    })

    it('レガシー形式を解析する（characterId に - を含む）', () => {
      expect(parseEditCustomId('char-edit-status-hp-char-1')).toEqual({
        kind: 'legacy',
        sectionType: 'status',
        fieldKey: 'hp',
        characterId: 'char-1'
      })
    })

    it('レガシー形式でパーツ不足は invalid', () => {
      // 'char-edit-status-hp' -> rest='status-hp' -> parts=['status','hp'] length=2<3
      expect(parseEditCustomId('char-edit-status-hp')).toEqual({ kind: 'invalid' })
      // 'char-edit-status' -> rest='status' -> parts=['status'] length=1<3
      expect(parseEditCustomId('char-edit-status')).toEqual({ kind: 'invalid' })
    })

    it('未知の形式は invalid', () => {
      expect(parseEditCustomId('unknown-id')).toEqual({ kind: 'invalid' })
    })

    it('セッション形式はレガシーより優先される', () => {
      // char-edit-modal- prefix が先に判定される
      const result = parseEditCustomId('char-edit-modal-abc-def')
      expect(result).toEqual({ kind: 'session', sessionId: 'abc-def' })
    })
  })

  describe('parseCreationCustomId', () => {
    it('channelId と userId を抽出する', () => {
      expect(parseCreationCustomId('character-create-basic-chan123-user456')).toEqual({
        channelId: 'chan123',
        userId: 'user456'
      })
    })

    it('マッチしない場合は null を返す', () => {
      expect(parseCreationCustomId('other-id')).toEqual({ channelId: null, userId: null })
    })
  })

  describe('buildFieldData', () => {
    it('trim して undefined 化し、有効なら返す', () => {
      expect(buildFieldData({ name: ' Hero ', values: ' 10 ', dice: '', description: '  ' })).toEqual({
        name: 'Hero',
        values: '10',
        dice: undefined,
        description: undefined
      })
    })

    it('values/dice/description がすべて空なら null', () => {
      expect(buildFieldData({ name: 'Hero' })).toBeNull()
      expect(buildFieldData({})).toBeNull()
    })

    it('dice のみあれば有効', () => {
      expect(buildFieldData({ dice: '1d100' })).toEqual({
        name: undefined,
        values: undefined,
        dice: '1d100',
        description: undefined
      })
    })

    it('undefined 入力でも安全に処理する', () => {
      expect(buildFieldData({ name: undefined, values: undefined })).toBeNull()
    })
  })

  describe('buildAttributeValueFromForm', () => {
    it('通常フィールド: finalName=name、values を base に', () => {
      const { actualFieldKey, attributeValue } = buildAttributeValueFromForm(
        'hp',
        { name: 'HP', values: '20', description: 'desc', dice: '1d6' },
        12345
      )!
      expect(actualFieldKey).toBe('hp')
      expect(attributeValue).toEqual({
        name: 'HP',
        values: { base: 20 },
        description: 'desc',
        dice: '1d6',
        isVisible: true
      })
    })

    it('既存フィールド: 非base part・index・isVisibleを維持し、合算値からbaseを再計算する', () => {
      const { attributeValue } = buildAttributeValueFromForm('hp', { values: '20' }, 0, {
        name: 'HP',
        index: 3,
        values: { base: 10, other: 5, growth: 2 },
        description: 'old description',
        dice: '1d6',
        isVisible: false
      })!

      expect(attributeValue).toEqual({
        name: 'HP',
        index: 3,
        values: { other: 5, growth: 2, base: 13 },
        isVisible: false
      })
    })

    it('既存フィールド: フォームのname・description・diceを優先する', () => {
      const { attributeValue } = buildAttributeValueFromForm(
        'hp',
        { name: 'Hit Point', values: '20', description: 'new description', dice: '2d6' },
        0,
        {
          name: 'HP',
          values: { base: 10, other: 5 },
          description: 'old description',
          dice: '1d6'
        }
      )!

      expect(attributeValue).toEqual({
        name: 'Hit Point',
        values: { other: 5, base: 15 },
        description: 'new description',
        dice: '2d6',
        isVisible: true
      })
    })

    it('既存フィールド: 合算値を保つためbaseの負数を許容する', () => {
      const { attributeValue } = buildAttributeValueFromForm('hp', { values: '20' }, 0, {
        values: { base: 10, other: 25 }
      })!

      expect(attributeValue.values).toEqual({ other: 25, base: -5 })
    })

    it('既存フィールド: 有限のゼロ入力でも合算値が0になるようbaseを再計算する', () => {
      const { attributeValue } = buildAttributeValueFromForm('hp', { values: '0' }, 0, {
        values: { base: 10, other: 5 }
      })!

      expect(attributeValue.values).toEqual({ other: 5, base: -5 })
    })

    it('既存フィールド: 非数値partを合算せず有限のbaseを構築する', () => {
      const { attributeValue } = buildAttributeValueFromForm('hp', { values: '20' }, 0, {
        values: { base: 10, broken: 'x' as unknown as number }
      })!

      expect(attributeValue.values.base).toBe(20)
      expect(Number.isFinite(attributeValue.values.base)).toBe(true)
    })

    it('既存フィールド: 数値欄が空なら非base partを含むvalues全体をクリアする', () => {
      const { attributeValue } = buildAttributeValueFromForm('hp', { values: '   ' }, 0, {
        name: 'HP',
        index: 3,
        values: { base: 10, other: 5, growth: 2 },
        isVisible: false
      })!

      expect(attributeValue).toEqual({
        name: 'HP',
        index: 3,
        values: {},
        isVisible: false
      })
    })

    it('既存フィールド: valuesを持たないAttributeValueでも数値を編集できる', () => {
      const result = buildAttributeValueFromForm('hp', { values: '20' }, 0, {
        name: 'HP',
        description: 'legacy description'
      })

      expect(result).toEqual({
        actualFieldKey: 'hp',
        attributeValue: {
          name: 'HP',
          values: { base: 20 },
          isVisible: true
        }
      })
    })

    it('name 無し: finalName=fieldKey', () => {
      const { actualFieldKey, attributeValue } = buildAttributeValueFromForm('hp', { values: '5' }, 0)!
      expect(actualFieldKey).toBe('hp')
      expect(attributeValue.name).toBe('hp')
      expect(attributeValue.values).toEqual({ base: 5 })
      expect(attributeValue.description).toBeUndefined()
      expect(attributeValue.dice).toBeUndefined()
      expect(attributeValue).not.toHaveProperty('index')
    })

    it('add_new + name あり: actualFieldKey=name', () => {
      const { actualFieldKey, attributeValue } = buildAttributeValueFromForm(
        'add_new',
        { name: '筋力', values: '3' },
        999
      )!
      expect(actualFieldKey).toBe('筋力')
      expect(attributeValue.name).toBe('筋力')
    })

    it('add_new は既存値を渡されても従来どおり新規値だけで構築する', () => {
      const { actualFieldKey, attributeValue } = buildAttributeValueFromForm(
        'add_new',
        { name: '筋力', values: '3' },
        999,
        {
          name: '既存名',
          index: 8,
          values: { base: 10, other: 5 },
          isVisible: false
        }
      )!

      expect(actualFieldKey).toBe('筋力')
      expect(attributeValue).toEqual({
        name: '筋力',
        values: { base: 3 },
        isVisible: true
      })
    })

    it('add_new + name 無し: actualFieldKey=new_{now}', () => {
      const { actualFieldKey, attributeValue } = buildAttributeValueFromForm('add_new', { values: '3' }, 777)!
      expect(actualFieldKey).toBe('new_777')
      expect(attributeValue.name).toBe('new_777')
    })

    it('既存フィールド: 非数値入力では既存partを残した構築結果を返さない', () => {
      expect(
        buildAttributeValueFromForm('hp', { name: 'HP', values: 'abc' }, 0, { values: { base: 10, other: 5 } })
      ).toBeNull()
    })

    it.each(['30abc', '20 HP', '２０', 'Infinity', '1e999'])('有限数でないvalues=%sは構築失敗にする', (values) => {
      expect(buildAttributeValueFromForm('hp', { name: 'HP', values }, 0)).toBeNull()
    })
  })

  describe('isValidAttributeValue', () => {
    const base: BuiltAttributeValue = {
      name: 'HP',
      values: {},
      isVisible: true
    }

    it('name 空なら無効', () => {
      expect(isValidAttributeValue({ ...base, name: '' })).toBe(false)
    })

    it('values/description/dice すべて空なら無効', () => {
      expect(isValidAttributeValue(base)).toBe(false)
    })

    it('values があれば有効', () => {
      expect(isValidAttributeValue({ ...base, values: { base: 1 } })).toBe(true)
    })

    it('description があれば有効', () => {
      expect(isValidAttributeValue({ ...base, description: 'x' })).toBe(true)
    })

    it('dice があれば有効', () => {
      expect(isValidAttributeValue({ ...base, dice: '1d6' })).toBe(true)
    })
  })

  describe('buildUpdateData', () => {
    const sectionData = { hp: { name: 'HP' } }

    it('status', () => {
      expect(buildUpdateData('status', sectionData)).toEqual({ status: sectionData })
    })
    it('parameter', () => {
      expect(buildUpdateData('parameter', sectionData)).toEqual({ parameter: sectionData })
    })
    it('skill', () => {
      expect(buildUpdateData('skill', sectionData)).toEqual({ skill: sectionData })
    })
    it('item', () => {
      expect(buildUpdateData('item', sectionData)).toEqual({ item: sectionData })
    })
    it('未対応セクションは null', () => {
      expect(buildUpdateData('basic' as never, sectionData)).toBeNull()
    })
  })
})
