import type { CharacterSheetTemplateEntity, SheetField } from '../characterTemplate/types/v3'
import type { CharacterSheetChange } from './api/character.service.server'

export const GENERIC_SHEET_CONFLICT_MESSAGE = '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。'

export type EditableScalarField = Extract<SheetField, { type: 'scalar' }> & {
  valueType: 'number' | 'text'
}

export type EditorValue = string | number | undefined

export function editableScalarFields(template: CharacterSheetTemplateEntity): EditableScalarField[] {
  return template.sections.flatMap((section) =>
    section.fields.filter(
      (field): field is EditableScalarField =>
        field.type === 'scalar' && (field.valueType === 'number' || field.valueType === 'text')
    )
  )
}

export function readEditableValue(field: EditableScalarField, values: Record<string, unknown>): EditorValue {
  const raw = values[field.uid]
  if (field.valueType === 'number' && field.parts) {
    if (typeof raw === 'number') return raw
    if (raw && typeof raw === 'object' && 'parts' in raw) {
      const parts = (raw as { parts?: Record<string, unknown> }).parts
      return typeof parts?.base === 'number' ? parts.base : undefined
    }
    return undefined
  }
  if (field.valueType === 'number') return typeof raw === 'number' ? raw : undefined
  return typeof raw === 'string' ? raw : undefined
}

export function deriveSheetChanges(
  fields: EditableScalarField[],
  baseline: Record<string, EditorValue>,
  values: Record<string, EditorValue>
): CharacterSheetChange[] {
  return fields.flatMap((field) => {
    const baseValue = baseline[field.uid]
    const newValue = values[field.uid]
    if (Object.is(baseValue, newValue)) return []
    return [
      {
        path: { fieldUid: field.uid, ...(field.parts ? { partsKey: 'base' } : {}) },
        baseValue,
        newValue
      }
    ]
  })
}
