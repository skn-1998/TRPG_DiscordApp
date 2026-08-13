import { RESERVED_PARTS_KEY_IDS, UNSAFE_PARTS_KEYS } from '@trpg/sheet-engine'
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

function isPresentablePartsKey(partsKey: string): boolean {
  return !RESERVED_PARTS_KEY_IDS.some((reservedKey) => reservedKey === partsKey) && !UNSAFE_PARTS_KEYS.has(partsKey)
}

function ownPartsKeys(raw: unknown): string[] {
  return isRecord(raw) && isRecord(raw.parts) ? Object.keys(raw.parts) : []
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

export function listEditablePartsKeys(
  field: EditableScalarField,
  baseline: Record<string, unknown>,
  values: Record<string, unknown>
): string[] {
  if (!usesPartsEditor(field)) return []
  const partsKeys = new Set<string>(['base'])
  const candidates = field.parts === true
    ? [...ownPartsKeys(baseline[field.uid]), ...ownPartsKeys(values[field.uid])]
    : (field.partsKeys ?? []).map(({ id }) => id)

  // publish 上流の B12-FIX より前に公開されたデータも守るため、TFR の isPresentablePartsKey と
  // 同じ reserved / UNSAFE 除外集合で表示経路だけでなく書込経路も閉じる。
  for (const partsKey of candidates) {
    if (isPresentablePartsKey(partsKey)) partsKeys.add(partsKey)
  }
  return [...partsKeys]
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
  if (partsKey === undefined) {
    const nextValues = { ...values }
    // conflict current の undefined は server 上の path 不存在を表すため、値の代入ではなくキー削除へ戻す。
    if (value === undefined) delete nextValues[field.uid]
    else nextValues[field.uid] = value
    return nextValues
  }

  const raw = values[field.uid]
  const rawRecord = isRecord(raw) ? raw : {}
  const parts: Record<string, unknown> = isRecord(rawRecord.parts)
    ? { ...rawRecord.parts }
    : { ...(typeof raw === 'number' && Number.isFinite(raw) ? { base: raw } : {}) }
  // conflict current の undefined は server 上の parts path 不存在と同型なので、兄弟を残して当該キーだけを削除する。
  if (value === undefined) delete parts[partsKey]
  else parts[partsKey] = value

  // front の書込先は局所表示 state だけで、payload は per-path の正規化値なので他 property の温存に影響されない。
  // canonical 正規化（{ parts } 全置換）は server writePathValue が所掌し、ここでは表示に必要な raw property を保つ。
  // 非 number / 非 parts raw への server の base:0 既定種付けは行わず、表示 state の差は payload に影響せず次回ロードで server 値へ収束する。
  return {
    ...values,
    [field.uid]: { ...rawRecord, parts }
  }
}

export function deriveSheetChanges(
  fields: EditableScalarField[],
  baseline: Record<string, unknown>,
  values: Record<string, unknown>
): CharacterSheetChange[] {
  return fields.flatMap((field) => {
    const partsKeys: Array<string | undefined> = usesPartsEditor(field)
      ? listEditablePartsKeys(field, baseline, values)
      : [undefined]
    return partsKeys.flatMap((partsKey) => {
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
  })
}
