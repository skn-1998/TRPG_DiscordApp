import { UnprocessableEntityException } from '@nestjs/common'
import type { ErrorEnvelope } from '@trpg/api-contract'
import { EPSILON, evaluateExpression, evaluateTemplate } from '@trpg/sheet-engine'
import type { SheetField, SheetTemplate } from '@trpg/sheet-engine'
import { DEFAULT_ERROR_RESPONSE_MESSAGE } from '../../../core/dto/api-response.dto'
import { isPartsValue, partsTotal, sheetValuesEqual } from './sheet-values.util'

export interface TrackBounds {
  min: number
  max: number
}

export type NonFiniteNumberKind = 'Infinity' | '-Infinity' | 'NaN'

export interface NonFiniteFieldDiagnostic {
  kind: 'computed' | 'roll' | 'track-max' | 'track-input' | 'resource-eval'
  fieldUid: string
  label?: string
  formula?: string
  result?: NonFiniteNumberKind
  detail?: string
  inputLocation?: string
}

export interface NonFiniteErrorIssue {
  fieldUid?: string
  path: string[]
  message: string
}

export interface BoundedNonFiniteErrorEnvelope {
  statusCode: 422
  error: 'Unprocessable Entity'
  message: string
  issues: NonFiniteErrorIssue[]
}

export interface SheetErrorEnvelopeMetadata {
  timestamp?: number
  requestId?: string
}

export interface SheetErrorEnvelopeExtensions {
  issues?: readonly NonFiniteErrorIssue[]
  cause?: Readonly<Record<string, unknown>>
}

const SHEET_ERROR_ENVELOPE_TIMESTAMP_PLACEHOLDER = 1_000_000_000_000
const SHEET_ERROR_ENVELOPE_REQUEST_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000000'

/**
 * sheet の HttpException が controller filter 適用後に取る最終 wire 封筒を作る。
 *
 * filter は実 timestamp / requestId と構造キャリアを渡して必ずこの builder を使うこと。別実装は禁止。
 * byte 会計時も同じ builder に固定幅 placeholder を渡し、実封筒とのキーと直列化形の乖離を防ぐ。
 */
export function buildSheetErrorEnvelope(
  error: string,
  { issues, cause }: SheetErrorEnvelopeExtensions = {},
  { timestamp = Date.now(), requestId }: SheetErrorEnvelopeMetadata = {}
): ErrorEnvelope {
  return {
    success: false,
    message: DEFAULT_ERROR_RESPONSE_MESSAGE,
    timestamp,
    requestId,
    error,
    ...(issues === undefined ? {} : { issues }),
    ...(cause === undefined ? {} : { cause })
  }
}

const NON_FINITE_DETAIL_LIMIT = 3
const NON_FINITE_FIELD_UID_DISPLAY_CHARACTER_LIMIT = 128
const NON_FINITE_LABEL_CHARACTER_LIMIT = 256
const NON_FINITE_FORMULA_CHARACTER_LIMIT = 120
const NON_FINITE_DETAIL_CHARACTER_LIMIT = 256
const NON_FINITE_INPUT_LOCATION_CHARACTER_LIMIT = 128
const NON_FINITE_HTTP_BODY_BYTE_BUDGET = 4_096
const NON_FINITE_COMPONENT_JSON_LENGTH_LIMITS = [1_024, 512, 256, 128, 64, 32, 16] as const
const NON_FINITE_ISSUE_LIMITS = ['unlimited', 3, 1, 0] as const
const MINIMAL_NON_FINITE_ERROR_MESSAGE = '入力値の検証に失敗しました。入力値を確認してください'
const MINIMAL_NON_FINITE_NEST_ERROR_BODY: BoundedNonFiniteErrorEnvelope = {
  statusCode: 422,
  error: 'Unprocessable Entity',
  message: MINIMAL_NON_FINITE_ERROR_MESSAGE,
  issues: []
}

type TrackRangeViolation = { side: 'min' | 'max'; amount: number } | null
type ExistingTrackInputValue =
  { kind: 'finite'; value: number | undefined } | { kind: 'non-finite'; result: NonFiniteNumberKind }

class NonFiniteTrackInputException extends UnprocessableEntityException {
  constructor(
    readonly result: NonFiniteNumberKind,
    diagnostic: NonFiniteFieldDiagnostic
  ) {
    super(buildBoundedNonFiniteErrorEnvelope([diagnostic]))
  }
}

export function toNonFiniteNumberKind(value: number): NonFiniteNumberKind {
  if (Number.isNaN(value)) {
    return 'NaN'
  }
  return value === Number.NEGATIVE_INFINITY ? '-Infinity' : 'Infinity'
}

/**
 * 非有限診断を含む現行 Nest 422 body を、最終 wire 形の byte 予算内で構築する。
 *
 * 非有限 issue を先頭に置き、予算超過時だけ件数単位で落とす。
 * 保持する既存 issue の fieldUid / path / message は加工しない。
 */
export function buildBoundedNonFiniteErrorEnvelope(
  diagnostics: readonly NonFiniteFieldDiagnostic[],
  existingIssues: readonly NonFiniteErrorIssue[] = []
): BoundedNonFiniteErrorEnvelope {
  for (const issueLimit of NON_FINITE_ISSUE_LIMITS) {
    for (const componentJsonLengthLimit of NON_FINITE_COMPONENT_JSON_LENGTH_LIMITS) {
      const displayed = diagnostics
        .slice(0, NON_FINITE_DETAIL_LIMIT)
        .map((diagnostic) => limitNonFiniteFieldDiagnostic(diagnostic, componentJsonLengthLimit))
      // production の非有限経路は必ず診断を渡すため、空配列は互換呼び出しへの安全網だけを担う。
      const diagnosticMessage =
        diagnostics.length === 0
          ? '非有限値の診断情報がありません。入力値を確認してください'
          : buildNonFiniteFieldMessage(
              displayed,
              diagnostics.length - displayed.length,
              componentJsonLengthLimit,
              diagnostics
            )
      const message = `${existingIssueCauseMessage(existingIssues)}${diagnosticMessage}`
      const diagnosticIssues = displayed.map((diagnostic) => ({
        fieldUid: diagnostic.fieldUid,
        path: [diagnostic.fieldUid],
        message: buildNonFiniteFieldMessage([diagnostic], 0, componentJsonLengthLimit, [diagnostic])
      }))
      const allIssues = [...diagnosticIssues, ...existingIssues]
      const envelope: BoundedNonFiniteErrorEnvelope = {
        statusCode: 422,
        error: 'Unprocessable Entity',
        message,
        issues: issueLimit === 'unlimited' ? allIssues : allIssues.slice(0, issueLimit)
      }
      if (nonFiniteHttpBodyBytes(envelope) <= NON_FINITE_HTTP_BODY_BYTE_BUDGET) {
        return envelope
      }
    }
  }

  return MINIMAL_NON_FINITE_NEST_ERROR_BODY
}

// 既存 import の互換名。封筒構築の実体は上の builder 一つだけに保つ。
export const formatNonFiniteFieldDiagnostics = buildBoundedNonFiniteErrorEnvelope

function buildNonFiniteFieldMessage(
  diagnostics: readonly NonFiniteFieldDiagnostic[],
  omittedCount: number,
  componentJsonLengthLimit: number,
  allDiagnostics: readonly NonFiniteFieldDiagnostic[]
): string {
  const details = diagnostics
    .map((diagnostic) => formatNonFiniteFieldDetail(diagnostic, componentJsonLengthLimit))
    .join('；')
  const omittedSummary = omittedCount > 0 ? `；ほか ${omittedCount} 件` : ''
  const { summary, guidance } = messagePartsFor(diagnostics[0].kind)
  const additionalCauses = additionalNonFiniteCauseMessage(allDiagnostics, diagnostics[0].kind)
  return `${summary}${additionalCauses}（${details}${omittedSummary}）。${guidance}`
}

function existingIssueCauseMessage(issues: readonly NonFiniteErrorIssue[]): string {
  if (issues.length === 0) return ''

  const causes = new Set<string>()
  for (const issue of issues) {
    if (issue.message.includes('is not defined by the template')) {
      causes.add('テンプレート未定義フィールド')
    } else if (issue.message.includes('is not an input field')) {
      causes.add('入力不可フィールド')
    } else if (issue.message.includes('finite number or string roll result')) {
      causes.add('ロール形式')
    } else {
      causes.add('入力型・制約')
    }
  }
  return `既存入力の問題: ${[...causes].join('・')}。`
}

function additionalNonFiniteCauseMessage(
  diagnostics: readonly NonFiniteFieldDiagnostic[],
  primaryKind: NonFiniteFieldDiagnostic['kind']
): string {
  const additionalKinds = [...new Set(diagnostics.map((diagnostic) => diagnostic.kind))].filter(
    (kind) => kind !== primaryKind
  )
  if (additionalKinds.length === 0) return ''
  return `（併発: ${additionalKinds.map((kind) => messagePartsFor(kind).summary).join('・')}）`
}

function limitNonFiniteFieldDiagnostic(
  diagnostic: NonFiniteFieldDiagnostic,
  componentJsonLengthLimit: number
): NonFiniteFieldDiagnostic {
  return {
    ...diagnostic,
    ...(diagnostic.label === undefined
      ? {}
      : {
          label: truncateDiagnosticText(diagnostic.label, NON_FINITE_LABEL_CHARACTER_LIMIT, componentJsonLengthLimit)
        }),
    ...(diagnostic.formula === undefined
      ? {}
      : {
          formula: truncateDiagnosticText(
            diagnostic.formula,
            NON_FINITE_FORMULA_CHARACTER_LIMIT,
            componentJsonLengthLimit
          )
        }),
    ...(diagnostic.detail === undefined
      ? {}
      : {
          detail: truncateDiagnosticText(diagnostic.detail, NON_FINITE_DETAIL_CHARACTER_LIMIT, componentJsonLengthLimit)
        }),
    ...(diagnostic.inputLocation === undefined
      ? {}
      : {
          inputLocation: truncateDiagnosticText(
            diagnostic.inputLocation,
            NON_FINITE_INPUT_LOCATION_CHARACTER_LIMIT,
            componentJsonLengthLimit
          )
        })
  }
}

function truncateDiagnosticText(value: string, maxCharacters: number, maxJsonLength: number): string {
  const prefixCharacters = Array.from(value.slice(0, maxCharacters * 2 + 2))
  const characters = prefixCharacters.slice(0, maxCharacters)
  const characterLimitedValue = characters.join('')
  const needsTruncation =
    prefixCharacters.length > maxCharacters ||
    characterLimitedValue.length < value.length ||
    JSON.stringify(value).length > maxJsonLength

  if (!needsTruncation) {
    return value
  }

  const ellipsis = '…'
  let low = 0
  let high = characters.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const candidate = `${characters.slice(0, middle).join('')}${ellipsis}`
    if (JSON.stringify(candidate).length <= maxJsonLength) {
      low = middle
    } else {
      high = middle - 1
    }
  }

  const truncated = `${characters.slice(0, low).join('')}${ellipsis}`
  return JSON.stringify(truncated).length <= maxJsonLength ? truncated : ''
}

export function nonFiniteHttpBodyBytes(envelope: BoundedNonFiniteErrorEnvelope): number {
  const wireModel = buildSheetErrorEnvelope(
    envelope.message,
    { issues: envelope.issues },
    {
      timestamp: SHEET_ERROR_ENVELOPE_TIMESTAMP_PLACEHOLDER,
      requestId: SHEET_ERROR_ENVELOPE_REQUEST_ID_PLACEHOLDER
    }
  )
  return Buffer.byteLength(JSON.stringify(wireModel), 'utf8')
}

function formatNonFiniteFieldDetail(diagnostic: NonFiniteFieldDiagnostic, componentJsonLengthLimit: number): string {
  const displayedFieldUid = truncateDiagnosticText(
    diagnostic.fieldUid,
    NON_FINITE_FIELD_UID_DISPLAY_CHARACTER_LIMIT,
    componentJsonLengthLimit
  )
  const parts = [`フィールド: ${displayedFieldUid}`]
  if (diagnostic.label !== undefined) {
    parts.push(`ラベル: ${diagnostic.label}`)
  }
  if (diagnostic.formula !== undefined) {
    parts.push(`式: ${diagnostic.formula}`)
  }
  if (diagnostic.inputLocation !== undefined) {
    parts.push(`入力箇所: ${diagnostic.inputLocation}`)
  }
  if (diagnostic.result !== undefined) {
    parts.push(`結果: ${diagnostic.result}`)
  }
  if (diagnostic.detail !== undefined) {
    parts.push(`原因: ${diagnostic.detail}`)
  }
  return parts.join(' / ')
}

function messagePartsFor(kind: NonFiniteFieldDiagnostic['kind']): { summary: string; guidance: string } {
  switch (kind) {
    case 'computed':
      return {
        summary: '計算式の結果が有限な数値になりませんでした',
        guidance: 'ゼロ除算などが起きていないか式を確認してください'
      }
    case 'roll':
      return {
        summary: 'ロール結果が有限な数値になりませんでした',
        guidance: '有限な数値または文字列のロール結果を確認してください'
      }
    case 'track-max':
      return {
        summary: 'トラック最大値の計算に失敗しました',
        guidance: '最大値の式を確認してください'
      }
    case 'track-input':
      return {
        summary: 'トラックの入力値が有限な数値になりませんでした',
        guidance: '有限な数値を入力してください'
      }
    case 'resource-eval':
      return {
        summary: 'リソースフィールドの計算結果が有限な数値になりませんでした',
        guidance: 'ゼロ除算などが起きていないかリソースフィールドの式と入力値を確認してください'
      }
  }
}

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
      const inputValue = this.trackInputValue(field, values[field.uid])
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

      const nextInputValue = this.trackInputValue(field, nextRaw)
      if (nextInputValue === undefined) continue

      // 比較基準を next bounds に固定する。別フィールド更新で境界だけ縮んだ未変更 track は、
      // evaluator / projection 用の正規化で吸収し、入力値を変更した扱いにはしない。
      const bounds = this.resolveBounds(field, nextValues)
      const currentInputValue = this.existingTrackInputValue(field, currentRaw)
      const nextViolation = this.rangeViolation(nextInputValue, bounds)
      const currentViolation = this.existingTrackRangeViolation(currentInputValue, bounds, nextViolation?.side)
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
      const rawInputValue = this.trackInputValue(field, nextRaw)
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
        throw new UnprocessableEntityException(
          buildBoundedNonFiniteErrorEnvelope([
            {
              kind: 'resource-eval',
              fieldUid: field.uid,
              label: field.label,
              ...(typeof effectiveValue?.value === 'number'
                ? { result: toNonFiniteNumberKind(effectiveValue.value) }
                : { detail: '数値として評価されませんでした' })
            }
          ])
        )
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
    const inputValue = this.trackInputValue(field, raw)
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
      typeof field.max === 'number' ? field.max : this.evaluateBoundExpression(field.max.formula, values, field)
    const min = field.min ?? 0
    if (min - max > EPSILON) {
      throw new UnprocessableEntityException(`resource field ${field.uid} resolved max below min`)
    }
    return { min, max: max < min ? min : max }
  }

  private evaluateBoundExpression(
    formula: string,
    values: Record<string, unknown>,
    field: Extract<SheetField, { type: 'track' }>
  ): number {
    try {
      const result = evaluateExpression(this.template, formula, { values })
      if (result.type !== 'number' || !Number.isFinite(result.value)) {
        throw new Error('formula did not produce a finite number')
      }
      return Number(result.value)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new UnprocessableEntityException(
        buildBoundedNonFiniteErrorEnvelope([
          {
            kind: 'track-max',
            fieldUid: field.uid,
            label: field.label,
            formula,
            detail
          }
        ])
      )
    }
  }

  private trackInputValue(field: Extract<SheetField, { type: 'track' }>, value: unknown): number | undefined {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        const result = toNonFiniteNumberKind(value)
        throw new NonFiniteTrackInputException(result, {
          kind: 'track-input',
          fieldUid: field.uid,
          label: field.label,
          inputLocation: 'フィールド値',
          result
        })
      }
      return value
    }
    if (!isPartsValue(value)) return undefined

    const invalidPart = Object.entries(value.parts).find(
      ([, part]) => typeof part !== 'number' || !Number.isFinite(part)
    )
    if (invalidPart !== undefined) {
      const [partName, part] = invalidPart
      if (typeof part === 'number') {
        const result = toNonFiniteNumberKind(part)
        throw new NonFiniteTrackInputException(result, {
          kind: 'track-input',
          fieldUid: field.uid,
          label: field.label,
          inputLocation: `parts.${partName}`,
          result
        })
      }
      throw new UnprocessableEntityException(
        buildBoundedNonFiniteErrorEnvelope([
          {
            kind: 'track-input',
            fieldUid: field.uid,
            label: field.label,
            inputLocation: `parts.${partName}`,
            detail: '数値ではない値が入力されています'
          }
        ])
      )
    }
    const total = partsTotal(value)
    if (!Number.isFinite(total)) {
      const result = toNonFiniteNumberKind(total)
      throw new NonFiniteTrackInputException(result, {
        kind: 'track-input',
        fieldUid: field.uid,
        label: field.label,
        inputLocation: 'parts 合計',
        result
      })
    }
    return total
  }

  private existingTrackInputValue(
    field: Extract<SheetField, { type: 'track' }>,
    value: unknown
  ): ExistingTrackInputValue {
    try {
      return { kind: 'finite', value: this.trackInputValue(field, value) }
    } catch (error) {
      if (error instanceof NonFiniteTrackInputException) {
        return { kind: 'non-finite', result: error.result }
      }
      throw error
    }
  }

  private existingTrackRangeViolation(
    input: ExistingTrackInputValue,
    bounds: TrackBounds,
    nextViolationSide: 'min' | 'max' | undefined
  ): TrackRangeViolation {
    if (input.kind === 'finite') {
      return input.value === undefined ? null : this.rangeViolation(input.value, bounds)
    }

    const side = input.result === 'NaN' ? nextViolationSide : input.result === '-Infinity' ? 'min' : 'max'
    return side === undefined ? null : { side, amount: Number.POSITIVE_INFINITY }
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
