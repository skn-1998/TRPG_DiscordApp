export function isPartsValue(value: unknown): value is { parts: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'parts' in value;
}

export function isPartsRecordValue(value: unknown): value is { parts: Record<string, unknown> } {
  return isPartsValue(value)
    && typeof value.parts === 'object'
    && value.parts !== null
    && !Array.isArray(value.parts);
}
