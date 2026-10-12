export function isFiniteNumberInput(value: string | number): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function hasPartKey(value: unknown, partsKey: string) {
  return isRecord(value) && isRecord(value.parts) && Object.prototype.hasOwnProperty.call(value.parts, partsKey)
}

export function readPartValue(value: unknown, partsKey: string): number | '' {
  if (partsKey === 'base' && typeof value === 'number' && Number.isFinite(value)) return value
  if (!isRecord(value) || !isRecord(value.parts)) return ''
  if (!Object.prototype.hasOwnProperty.call(value.parts, partsKey)) return ''
  const partValue = value.parts[partsKey]
  return typeof partValue === 'number' && Number.isFinite(partValue) ? partValue : ''
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** number または parts 形の有限な表示値を返し、不正値は未表示へ退化させる。 */
export function numberDisplayValue(raw: unknown): number | undefined {
  // 表示専用の退化契約。保存系の有限性検査（server policy）とは役割が別で、壊れた保存値でも表示を落とさない。
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (!isRecord(raw) || !isRecord(raw.parts)) return undefined

  let total = 0
  for (const part of Object.values(raw.parts)) {
    if (typeof part !== 'number' || !Number.isFinite(part)) return undefined
    total += part
  }
  return Number.isFinite(total) ? total : undefined
}
