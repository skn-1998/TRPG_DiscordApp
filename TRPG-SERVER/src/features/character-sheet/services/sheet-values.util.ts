import { allowsParts, type SheetField } from '@trpg/sheet-engine'

export { allowsParts }

export interface SheetPartsValue {
  parts: Record<string, number>
}

export function isResourceField(field: SheetField): field is Extract<SheetField, { type: 'track' | 'scalar' }> & {
  role: { kind: 'resource'; deltas: number[] }
} {
  return field.role?.kind === 'resource' && allowsParts(field)
}

export function isPartsValue(value: unknown): value is SheetPartsValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'parts' in value &&
    typeof value.parts === 'object' &&
    value.parts !== null &&
    !Array.isArray(value.parts)
  )
}

export function partsTotal(value: SheetPartsValue): number {
  return Object.values(value.parts).reduce((sum, part) => sum + part, 0)
}

export function sheetValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== typeof right || left === null || right === null) return false
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => sheetValuesEqual(value, right[index]))
  }
  if (typeof left !== 'object' || typeof right !== 'object') return false

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord).sort()
  const rightKeys = Object.keys(rightRecord).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && sheetValuesEqual(leftRecord[key], rightRecord[key]))
  )
}
