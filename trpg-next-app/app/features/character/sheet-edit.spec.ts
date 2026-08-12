import type { SheetField } from '../characterTemplate/types/v3'
import type { CharacterSheetTemplateEntity } from '../characterTemplate/types/v3'
import {
  deriveSheetChanges,
  editableScalarFields,
  readEditableValue,
  type EditableScalarField,
  type EditorValue
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

describe('readEditableValue', () => {
  it('parts 付き number は parts.base を返す', () => {
    expect(readEditableValue(partsField, { 'main.score': { parts: { base: 12, buff: 3 } } })).toBe(12)
  })

  it('parts なし number は number 直値を返す', () => {
    expect(readEditableValue(numberField, { 'main.hp': 8 })).toBe(8)
  })

  it('text は string 直値を返す', () => {
    expect(readEditableValue(textField, { 'main.name': '探索者' })).toBe('探索者')
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
    ['undefined から値', {}, { 'main.name': '探索者' }],
    ['値から undefined', { 'main.name': '探索者' }, { 'main.name': undefined }]
  ] as const)('%s への遷移を変更として返す', (_caseName, baseline, values) => {
    expect(deriveSheetChanges([textField], baseline, values as Record<string, EditorValue>)).toHaveLength(1)
  })

  it('Object.is で同値になる NaN は変更に含めない', () => {
    expect(deriveSheetChanges([numberField], { 'main.hp': Number.NaN }, { 'main.hp': Number.NaN })).toEqual([])
  })
})
