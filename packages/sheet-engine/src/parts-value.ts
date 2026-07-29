export function isPartsValue(value: unknown): value is { parts: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'parts' in value;
}
