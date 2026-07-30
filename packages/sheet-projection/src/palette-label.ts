// projection.ts の formatResourceValue が「値なし」に使う記号と一致させる（不一致だと suffix 剥離が誤作動する）
const PALETTE_VALUE_PLACEHOLDER = '—'

function formatPaletteValueSuffix(formattedValue: string | number | boolean): string {
  return ` (${formattedValue})`
}

export function formatPaletteLabel(baseLabel: string, formattedValue: string | number | boolean): string {
  return `${baseLabel}${formatPaletteValueSuffix(formattedValue)}`
}

export function stripMatchingPaletteValueSuffix(label: string, formattedValue: string): string {
  if (formattedValue === PALETTE_VALUE_PLACEHOLDER) {
    return label
  }

  const suffix = formatPaletteValueSuffix(formattedValue)
  return label.endsWith(suffix) ? label.slice(0, -suffix.length) : label
}
