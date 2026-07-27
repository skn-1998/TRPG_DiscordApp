import { UnprocessableEntityException } from '@nestjs/common'
import { EPSILON, evaluateExpression, evaluateTemplate } from '@trpg/sheet-engine'
import type { SheetField, SheetTemplate } from '@trpg/sheet-engine'
import { isPartsValue, partsTotal, sheetValuesEqual } from './sheet-values.util'

export interface TrackBounds {
  min: number
  max: number
}

type TrackRangeViolation = { side: 'min' | 'max'; amount: number } | null

/**
 * Track の入力値、解決済み範囲、legacy 互換の保存規則を一箇所で扱う。
 *
 * sheet-engine evaluator は変更せず、hub 投影も feature 境界でこの policy の実効値へ解決する。
 */
export class TrackRangePolicy {
  private readonly boundsByValues = new WeakMap<Record<string, unknown>, Map<string, TrackBounds>>()

  constructor(private readonly template: SheetTemplate) {}

  /**
   * 新規作成には既存違反がないため、入力された全 track が解決済み範囲内であることを要求する。
   */
  assertCreationValuesWithinBounds(values: Record<string, unknown>): void {
    for (const field of this.trackFields()) {
      const inputValue = this.trackInputValue(field.uid, values[field.uid])
      if (inputValue === undefined) continue

      const bounds = this.resolveBounds(field, values)
      if (this.rangeViolation(inputValue, bounds) === null) continue
      this.throwOutOfBounds(field.uid, inputValue, bounds)
    }
  }

  /**
   * 実際に入力値が変わった track だけを検査し、既存違反の維持・縮小を許容する。
   */
  assertNoWorsenedTrackValues(currentValues: Record<string, unknown>, nextValues: Record<string, unknown>): void {
    for (const field of this.trackFields()) {
      const currentRaw = currentValues[field.uid]
      const nextRaw = nextValues[field.uid]
      if (sheetValuesEqual(currentRaw, nextRaw)) continue

      const nextInputValue = this.trackInputValue(field.uid, nextRaw)
      if (nextInputValue === undefined) continue

      // 比較基準を next bounds に固定する。別フィールド更新で境界だけ縮んだ未変更 track は、
      // evaluator / projection 用の正規化で吸収し、入力値を変更した扱いにはしない。
      const bounds = this.resolveBounds(field, nextValues)
      const currentInputValue = this.trackInputValue(field.uid, currentRaw)
      const currentViolation = currentInputValue === undefined ? null : this.rangeViolation(currentInputValue, bounds)
      const nextViolation = this.rangeViolation(nextInputValue, bounds)
      if (nextViolation === null) continue
      if (currentViolation?.side === nextViolation.side && nextViolation.amount <= currentViolation.amount + EPSILON) {
        continue
      }

      this.throwOutOfBounds(field.uid, nextInputValue, bounds)
    }
  }

  /**
   * 範囲外 legacy 値は materialize 中だけクランプし、呼び出し側が保存する正本値は変更しない。
   */
  toLegacyCompatibleMaterializationValues(
    currentValues: Record<string, unknown>,
    nextValues: Record<string, unknown>,
    evaluated: ReturnType<typeof evaluateTemplate>
  ): Record<string, unknown> {
    const materializationValues = { ...nextValues }
    for (const field of this.trackFields()) {
      const currentRaw = currentValues[field.uid]
      const nextRaw = nextValues[field.uid]
      const rawInputValue = this.trackInputValue(field.uid, nextRaw)
      if (rawInputValue === undefined) continue

      let bounds: TrackBounds
      try {
        bounds = this.resolveBounds(field, nextValues)
      } catch (error) {
        // 変更していない track の境界だけが不正化しても、無関係な保存を止めない。
        if (sheetValuesEqual(currentRaw, nextRaw)) continue
        throw error
      }
      if (this.rangeViolation(rawInputValue, bounds) === null) continue

      const effectiveValue = evaluated.values[field.uid]
      if (effectiveValue?.type !== 'number' || !Number.isFinite(effectiveValue.value)) {
        throw new UnprocessableEntityException(`resource field ${field.uid} did not evaluate to a finite number`)
      }
      materializationValues[field.uid] = this.clampToBounds(Number(effectiveValue.value), bounds)
    }
    return materializationValues
  }

  /**
   * field の解決済み範囲を values snapshot ごとに返す。
   *
   * 渡した values は以後変更しないこと。変更する場合は新しいオブジェクトを渡す。
   * メモ化は values オブジェクトの同一性をキーにしており、無効化機構はない。
   */
  resolveBounds(
    field: Extract<SheetField, { type: 'track' | 'scalar' }>,
    values: Record<string, unknown>
  ): TrackBounds {
    const cached = this.boundsCache(values).get(field.uid)
    if (cached !== undefined) return cached

    const bounds = this.calculateBounds(field, values)
    this.boundsCache(values).set(field.uid, bounds)
    return bounds
  }

  resolveEffectiveValue(
    field: Extract<SheetField, { type: 'track' | 'scalar' }>,
    raw: unknown,
    evaluatedValue: number,
    bounds: TrackBounds
  ): number {
    if (field.type !== 'track') return evaluatedValue
    const inputValue = this.trackInputValue(field.uid, raw)
    return this.clampToBounds(inputValue ?? evaluatedValue, bounds)
  }

  private clampToBounds(value: number, bounds: TrackBounds): number {
    return Math.min(bounds.max, Math.max(bounds.min, value))
  }

  private calculateBounds(
    field: Extract<SheetField, { type: 'track' | 'scalar' }>,
    values: Record<string, unknown>
  ): TrackBounds {
    if (field.type === 'scalar') {
      return { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY }
    }

    const max =
      typeof field.max === 'number' ? field.max : this.evaluateBoundExpression(field.max.formula, values, field.uid)
    const min = field.min ?? 0
    if (min - max > EPSILON) {
      throw new UnprocessableEntityException(`resource field ${field.uid} resolved max below min`)
    }
    return { min, max: max < min ? min : max }
  }

  private evaluateBoundExpression(formula: string, values: Record<string, unknown>, fieldUid: string): number {
    try {
      const result = evaluateExpression(this.template, formula, { values })
      if (result.type !== 'number' || !Number.isFinite(result.value)) {
        throw new Error('formula did not produce a finite number')
      }
      return Number(result.value)
    } catch (error) {
      throw new UnprocessableEntityException({
        message: `resource max evaluation failed for ${fieldUid}`,
        fieldUid,
        detail: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private trackInputValue(fieldUid: string, value: unknown): number | undefined {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new UnprocessableEntityException(`track field ${fieldUid} must be a finite number`)
      }
      return value
    }
    if (!isPartsValue(value)) return undefined

    const parts = Object.values(value.parts)
    if (parts.some((part) => typeof part !== 'number' || !Number.isFinite(part))) {
      throw new UnprocessableEntityException(`track field ${fieldUid} parts must be finite numbers`)
    }
    return partsTotal(value)
  }

  private rangeViolation(value: number, bounds: TrackBounds): TrackRangeViolation {
    const belowMin = bounds.min - value
    if (belowMin > EPSILON) return { side: 'min', amount: belowMin }
    const aboveMax = value - bounds.max
    if (aboveMax > EPSILON) return { side: 'max', amount: aboveMax }
    return null
  }

  private trackFields(): Array<Extract<SheetField, { type: 'track' }>> {
    return this.template.sections.flatMap((section) =>
      section.fields.filter((field): field is Extract<SheetField, { type: 'track' }> => field.type === 'track')
    )
  }

  private boundsCache(values: Record<string, unknown>): Map<string, TrackBounds> {
    const existing = this.boundsByValues.get(values)
    if (existing !== undefined) return existing
    const created = new Map<string, TrackBounds>()
    this.boundsByValues.set(values, created)
    return created
  }

  private throwOutOfBounds(fieldUid: string, value: number, bounds: TrackBounds): never {
    throw new UnprocessableEntityException({
      message: `track field ${fieldUid} value is outside resolved bounds`,
      fieldUid,
      value,
      min: bounds.min,
      max: bounds.max
    })
  }
}
