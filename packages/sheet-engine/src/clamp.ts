export interface ClampDeltaResult {
  effectiveDelta: number;
  clamped: boolean;
}

export function clampDelta(
  current: number,
  delta: number,
  min: number = 0,
  max: number,
): ClampDeltaResult {
  const requested = current + delta;
  const next = Math.min(max, Math.max(min, requested));
  const effectiveDelta = next - current;
  return {
    effectiveDelta,
    clamped: next !== requested,
  };
}
