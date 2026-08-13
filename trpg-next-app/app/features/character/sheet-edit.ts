import { isPresentablePartsKey } from '../characterSheet/parts-key-visibility'
import type { CharacterSheetTemplateEntity, SheetField } from '../characterTemplate/types/v3'
import type { CharacterSheetChange } from './api/character.service.server'

export const GENERIC_SHEET_CONFLICT_MESSAGE = '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。'

export type EditableScalarField = Extract<SheetField, { type: 'scalar' }> & {
  valueType: 'number' | 'text' | 'boolean' | 'select'
}

export type EditorValue = string | number | boolean | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
        // NOTE: editor 由来の契約外 valueType（'checkbox' 等）を runtime で弾くため明示列挙する。
        field.type === 'scalar' && (
          field.valueType === 'number'
          || field.valueType === 'text'
          || field.valueType === 'boolean'
          || field.valueType === 'select'
        )
    )
  )
}

/**
 * payload/CAS 健全性の防壁を 1 定義に保ち、読み取り経路の片方だけ直る drift を防ぐ。
 *
 * Invariant: server の非 parts readPathValue は raw を素通しするため同値ではない。
 * baseValue: unknown に型防壁はなく、この正規化が payload 健全性の front 側唯一の防壁となる。
 * number の有限性だけは EditClient の入力ガードが担う。
 */
export function normalizeEditorValue(field: EditableScalarField, value: unknown): EditorValue {
  if (field.valueType === 'number') return typeof value === 'number' ? value : undefined
  if (field.valueType === 'boolean') return typeof value === 'boolean' ? value : undefined
  // text/select の文字列型を共通で保証する。select の語彙検査は template/server の所掌。
  return typeof value === 'string' ? value : undefined
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
  if (partsKey !== undefined) {
    if (field.valueType !== 'number') return undefined
    if (partsKey === 'base' && typeof raw === 'number') return raw
    if (!isRecord(raw) || !isRecord(raw.parts)) return undefined
    const part = raw.parts[partsKey]
    return typeof part === 'number' ? part : undefined
  }
  return normalizeEditorValue(field, raw)
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
