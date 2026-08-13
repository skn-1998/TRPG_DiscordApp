import type { CharacterSheetTemplateEntity, SheetField } from '../characterTemplate/types/v3'
import type { CharacterSheetChange } from './api/character.service.server'

export const GENERIC_SHEET_CONFLICT_MESSAGE = '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。'

export type EditableScalarField = Extract<SheetField, { type: 'scalar' }> & {
  valueType: 'number' | 'text'
}

export type EditorValue = string | number | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function usesPartsEditor(field: EditableScalarField): boolean {
  // TFR の isPartsScalarField・engine value-input の allowsParts と同値である必要がある。変更時は三者を同期する。
  return field.valueType === 'number' && (field.parts === true || field.partsKeys !== undefined)
}

export function editableScalarFields(template: CharacterSheetTemplateEntity): EditableScalarField[] {
  return template.sections.flatMap((section) =>
    section.fields.filter(
      (field): field is EditableScalarField =>
        field.type === 'scalar' && (field.valueType === 'number' || field.valueType === 'text')
    )
  )
}

export function readSheetPathValue(
  field: EditableScalarField,
  partsKey: string | undefined,
  values: Record<string, unknown>
): EditorValue {
  const raw = values[field.uid]
  // payload/CAS 用に valueType で意図的に狭める正規化。server の partsKey なし readPathValue は raw を
  // そのまま返すため同値ではない。baseValue: unknown に型防壁はなく、この正規化が payload 健全性の唯一の防壁になる。
  if (partsKey !== undefined) {
    if (field.valueType !== 'number') return undefined
    if (partsKey === 'base' && typeof raw === 'number') return raw
    if (!isRecord(raw) || !isRecord(raw.parts)) return undefined
    const part = raw.parts[partsKey]
    return typeof part === 'number' ? part : undefined
  }
  if (field.valueType === 'number') return typeof raw === 'number' ? raw : undefined
  return typeof raw === 'string' ? raw : undefined
}

export function writeSheetPathValue(
  field: EditableScalarField,
  partsKey: string | undefined,
  value: EditorValue,
  values: Record<string, unknown>
): Record<string, unknown> {
  if (partsKey === undefined) return { ...values, [field.uid]: value }

  // S5b1 の base 書込に限り、parts の更新結果は server writePathValue と一致する。server は flat number から
  // base を種付けして { parts } で field を全置換し、client は他の raw property を温存する。非 base 書込を
  // 解禁する S5b2 では、この種付けと置換方針の差を裁定・解消することが開始条件になる。
  const raw = values[field.uid]
  const rawRecord = isRecord(raw) ? raw : {}
  const parts = isRecord(rawRecord.parts) ? rawRecord.parts : {}
  return {
    ...values,
    [field.uid]: { ...rawRecord, parts: { ...parts, [partsKey]: value } }
  }
}

export function deriveSheetChanges(
  fields: EditableScalarField[],
  baseline: Record<string, unknown>,
  values: Record<string, unknown>
): CharacterSheetChange[] {
  return fields.flatMap((field) => {
    const partsKey = usesPartsEditor(field) ? 'base' : undefined
    const baseValue = readSheetPathValue(field, partsKey, baseline)
    const newValue = readSheetPathValue(field, partsKey, values)
    if (Object.is(baseValue, newValue)) return []
    return [
      {
        path: { fieldUid: field.uid, ...(partsKey === undefined ? {} : { partsKey }) },
        baseValue,
        newValue
      }
    ]
  })
}
