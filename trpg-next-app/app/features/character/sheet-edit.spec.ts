import type { SheetField } from '../characterTemplate/types/v3'
import type { CharacterSheetTemplateEntity } from '../characterTemplate/types/v3'
import {
  deriveSheetChanges,
  editableScalarFields,
  listEditablePartsKeys,
  readSheetPathValue,
  usesPartsEditor,
  writeSheetPathValue,
  type EditableScalarField
} from './sheet-edit'

function createTemplate(fields: SheetField[]): CharacterSheetTemplateEntity {
  return {
    templateId: 'template-1',
    name: 'テストテンプレート',
    version: '1.0.0',
    schemaVersion: 3,
    tags: [],
    visibility: 'private',
    authorDiscordUserId: 'user-1',
    sections: [{ id: 'main', label: 'メイン', fields }],
    tables: [],
    settings: { rounding: 'round' },
    status: 'draft',
    draftRevision: 1
  }
}

const numberField: EditableScalarField = {
  type: 'scalar',
  id: 'hp',
  uid: 'main.hp',
  label: 'HP',
  valueType: 'number'
}

const partsField: EditableScalarField = {
  ...numberField,
  id: 'score',
  uid: 'main.score',
  label: 'Score',
  parts: true
}

const declaredPartsField: EditableScalarField = {
  ...numberField,
  partsKeys: [{ id: 'growth', label: 'Growth' }]
}

const legacyDeclaredPartsField: EditableScalarField = {
  ...declaredPartsField,
  partsKeys: [
    { id: 'growth', label: 'Growth' },
    { id: 'base', label: 'Base' },
    { id: 'other', label: 'Other' },
    { id: 'constructor', label: 'Constructor' }
  ]
}

const textField: EditableScalarField = {
  type: 'scalar',
  id: 'name',
  uid: 'main.name',
  label: '名前',
  valueType: 'text'
}

describe('editableScalarFields', () => {
  it('number/text scalar だけを残し、scalar 以外と select/checkbox を除外する', () => {
    const selectField: SheetField = {
      type: 'scalar',
      id: 'job',
      uid: 'main.job',
      label: '職業',
      valueType: 'select'
    }
    const checkboxField = {
      type: 'scalar',
      id: 'active',
      uid: 'main.active',
      label: '有効',
      valueType: 'checkbox'
    } as unknown as SheetField
    const computedField: SheetField = {
      type: 'computed',
      id: 'total',
      uid: 'main.total',
      label: '合計',
      resultType: 'number',
      formula: '1'
    }

    expect(editableScalarFields(createTemplate([numberField, textField, selectField, checkboxField, computedField])))
      .toEqual([numberField, textField])
  })
})

describe('readSheetPathValue', () => {
  // 正規化除去の変異が 468 全緑で生存した無防備領域を閉じる。baseValue: unknown のため型防壁も無く、
  // この正規化が CAS payload 健全性の唯一の防壁。
  it.each([
    ['非 parts number の object raw', numberField, undefined, { broken: true }, undefined],
    ['非 parts number の boolean raw', numberField, undefined, true, undefined],
    ['非 parts number の string raw', numberField, undefined, '8', undefined],
    ['非 parts number の number raw', numberField, undefined, 8, 8],
    ['text の number raw', textField, undefined, 8, undefined],
    ['text の object raw', textField, undefined, { broken: true }, undefined],
    ['text の空文字 raw', textField, undefined, '', ''],
    ['text の string raw', textField, undefined, '探索者', '探索者'],
    ['parts base の flat number raw', partsField, 'base', 12, 12],
    ['parts base を持つ record raw', partsField, 'base', { parts: { base: 12 } }, 12],
    ['parts base を欠く record raw', partsField, 'base', { parts: {} }, undefined],
    ['parts base の非 record raw', partsField, 'base', true, undefined],
    ['非 base partsKey を持つ record raw', partsField, 'growth', { parts: { growth: 5 } }, 5],
    ['非 base partsKey を欠く record raw', partsField, 'growth', { parts: { base: 10 } }, undefined]
  ] as const)('%s を正規化する', (_caseName, field, partsKey, raw, expected) => {
    expect(readSheetPathValue(field, partsKey, { [field.uid]: raw })).toBe(expected)
  })
})

describe('writeSheetPathValue', () => {
  it('parts を不変再構築し、元 record を変えずに他の field・record・parts キーを温存する', () => {
    const raw = { note: 'keep', parts: { base: 10, growth: 5 } }
    const values = { 'main.score': raw, 'main.hp': 8 }

    const next = writeSheetPathValue(partsField, 'base', 9, values)

    expect(next).toEqual({
      'main.score': { note: 'keep', parts: { base: 9, growth: 5 } },
      'main.hp': 8
    })
    expect(values).toEqual({ 'main.score': { note: 'keep', parts: { base: 10, growth: 5 } }, 'main.hp': 8 })
    expect(next).not.toBe(values)
    expect(next['main.score']).not.toBe(raw)
  })

  it('parts の flat number raw を parts.base record に再構築する', () => {
    expect(writeSheetPathValue(partsField, 'base', 9, { 'main.score': 10 })).toEqual({
      'main.score': { parts: { base: 9 } }
    })
  })

  it('flat number raw の base を温存して宣言キーを追加する', () => {
    // flat raw の非 base 書込でも server と同じ base 種付けを行うことを固定する。
    expect(writeSheetPathValue(partsField, 'growth', 5, { 'main.score': 10 })).toEqual({
      'main.score': { parts: { base: 10, growth: 5 } }
    })
  })

  it('非 parts path へプリミティブを代入する', () => {
    expect(writeSheetPathValue(numberField, undefined, 9, { 'main.hp': 10, untouched: true })).toEqual({
      'main.hp': 9,
      untouched: true
    })
  })

  it.each([
    [
      '非 parts field',
      numberField,
      undefined,
      { 'main.hp': 10, untouched: true },
      { untouched: true }
    ],
    [
      'parts の当該キー',
      partsField,
      'growth',
      { 'main.score': { note: 'keep', parts: { base: 10, growth: 5 } }, untouched: true },
      { 'main.score': { note: 'keep', parts: { base: 10 } }, untouched: true }
    ]
  ] as const)('undefined 書込は%sだけを削除する', (_caseName, field, partsKey, values, expected) => {
    // toEqual は own undefined と欠落を同一視して delete -> undefined 代入変異を通したため、Fable 実測どおり両面で固定する。
    const result = writeSheetPathValue(field, partsKey, undefined, values)
    const deletionOwner = partsKey === undefined
      ? result
      : (result[field.uid] as { parts: Record<string, unknown> }).parts

    expect(result).toStrictEqual(expected)
    expect(Object.prototype.hasOwnProperty.call(deletionOwner, partsKey ?? field.uid)).toBe(false)
  })
})

describe('listEditablePartsKeys', () => {
  it.each([
    [
      '非 parts field',
      numberField,
      { 'main.hp': 10 },
      { 'main.hp': 11 },
      []
    ],
    // reserved / UNSAFE だけでは生存した raw own キー和集合変異を、未宣言の安全な legacy でも遮断する。
    [
      '宣言モード',
      legacyDeclaredPartsField,
      { 'main.hp': { parts: { base: 10, growth: 5, legacy: 7, other: 2, constructor: 3 } } },
      { 'main.hp': { parts: { base: 10, growth: 6, legacy: 8, other: 4, constructor: 5 } } },
      ['base', 'growth']
    ],
    [
      '自由モード',
      partsField,
      { 'main.score': { parts: { base: 10, career: 4, other: 2, prototype: 3 } } },
      { 'main.score': { parts: { base: 10, growth: 5, other: 4, prototype: 6 } } },
      ['base', 'career', 'growth']
    ]
  ] as const)('%sは提示可能な parts path だけを列挙する', (
    _caseName,
    field,
    baseline,
    values,
    expected
  ) => {
    // TFR と同じ reserved / UNSAFE 防御を、宣言データと自由データの両方の書込列挙で固定する。
    expect(listEditablePartsKeys(field, baseline, values)).toEqual(expected)
  })
})

describe('usesPartsEditor', () => {
  it.each([
    ['parts:true', partsField, true],
    ['partsKeys 宣言', declaredPartsField, true],
    ['非 parts', numberField, false]
  ] as const)('%s を %s と判定する', (_caseName, field, expected) => {
    expect(usesPartsEditor(field)).toBe(expected)
  })
})

describe('deriveSheetChanges', () => {
  it('値が変わっていなければ空配列を返す', () => {
    expect(deriveSheetChanges([numberField, textField], { 'main.hp': 8, 'main.name': '探索者' }, {
      'main.hp': 8,
      'main.name': '探索者'
    })).toEqual([])
  })

  it("parts 付き field の変更には partsKey: 'base' を付ける", () => {
    expect(
      deriveSheetChanges([partsField], { 'main.score': 10 }, { 'main.score': 11 })
    ).toEqual([
      {
        path: { fieldUid: 'main.score', partsKey: 'base' },
        baseValue: 10,
        newValue: 11
      }
    ])
  })

  it.each([
    // 宣言一覧を無視する raw own キー和集合変異が、安全な未宣言 legacy の値差でも change を作る穴を閉じる。
    [
      '宣言モード',
      declaredPartsField,
      { 'main.hp': { parts: { base: 10, growth: 5, legacy: 7 } } },
      { 'main.hp': { parts: { base: 10, growth: 6, legacy: 8 } } },
      [{ path: { fieldUid: 'main.hp', partsKey: 'growth' }, baseValue: 5, newValue: 6 }]
    ],
    [
      '自由モードの baseline/values 和集合',
      partsField,
      { 'main.score': { parts: { base: 10, career: 4 } } },
      { 'main.score': { parts: { base: 10, growth: 5 } } },
      [
        { path: { fieldUid: 'main.score', partsKey: 'career' }, baseValue: 4, newValue: undefined },
        { path: { fieldUid: 'main.score', partsKey: 'growth' }, baseValue: undefined, newValue: 5 }
      ]
    ]
  ] as const)('%sの非 base partsKey を per-path change にする', (_caseName, field, baseline, values, expected) => {
    // base 以外も whole-field payload に混ぜず、各 partsKey の CAS 値だけを送ることを固定する。
    const changes = deriveSheetChanges([field], baseline, values)

    expect(changes).toEqual(expected)
    if (_caseName === '自由モードの baseline/values 和集合') {
      const wireChanges = JSON.parse(JSON.stringify(changes)) as Array<Record<string, unknown>>
      expect(Object.prototype.hasOwnProperty.call(wireChanges[0], 'newValue')).toBe(false)
    }
  })

  it.each([
    ['undefined から値', {}, { 'main.name': '探索者' }],
    ['値から undefined', { 'main.name': '探索者' }, { 'main.name': undefined }]
  ] as const)('%s への遷移を変更として返す', (_caseName, baseline, values) => {
    expect(deriveSheetChanges([textField], baseline, values)).toHaveLength(1)
  })

  it('Object.is で同値になる NaN は変更に含めない', () => {
    expect(deriveSheetChanges([numberField], { 'main.hp': Number.NaN }, { 'main.hp': Number.NaN })).toEqual([])
  })

  it('退化 raw object の baseline を payload から除外した JSON byte を固定する', () => {
    const serialized = JSON.stringify(
      deriveSheetChanges([numberField], { 'main.hp': { broken: true } }, { 'main.hp': 9 })
    )

    expect(serialized).toBe('[{"path":{"fieldUid":"main.hp"},"newValue":9}]')
  })
})
