import { UnprocessableEntityException } from '@nestjs/common'
import type { ErrorEnvelope } from '@trpg/api-contract'
import { evaluateExpression } from '@trpg/sheet-engine'
import type { SheetField, SheetTemplate } from '@trpg/sheet-engine'
import { DEFAULT_ERROR_RESPONSE_MESSAGE } from '../../../core/dto/api-response.dto'
import { isPartsValue, partsTotal, sheetValuesEqual } from './sheet-values.util'

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
// character-sheet-operation.service.ts の競合値上限と同値だが、こちらは診断封筒全体の予算。対象が異なるため独立に変更してよい。
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

class NonFiniteTrackInputException extends UnprocessableEntityException {
  constructor(diagnostic: NonFiniteFieldDiagnostic) {
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
 * Track 入力の有限性診断と、advisory な raw 実効値の解決を一箇所で扱う。
 *
 * hub 投影も feature 境界でこの policy の実効値へ解決する。
 */
export class TrackRangePolicy {
  constructor(private readonly template: SheetTemplate) {}

  /**
   * track の min/max 範囲は advisory として扱う。
   * 全 track の next raw 有限性を先に検査し、変更された track だけ非有限な max 式と
   * 既存値の修復可能性を追加検査する。
   */
  assertFiniteTrackValues(currentValues: Record<string, unknown>, nextValues: Record<string, unknown>): void {
    const trackFields = this.trackFields()

    for (const field of trackFields) {
      this.trackInputValue(field, nextValues[field.uid])
    }

    for (const field of trackFields) {
      const currentRaw = currentValues[field.uid]
      const nextRaw = nextValues[field.uid]
      if (sheetValuesEqual(currentRaw, nextRaw)) continue

      const nextInputValue = this.trackInputValue(field, nextRaw)
      if (nextInputValue === undefined) continue

      if (typeof field.max !== 'number') {
        this.evaluateBoundExpression(field.max.formula, nextValues, field)
      }
      this.assertExistingTrackInputIsRepairable(field, currentRaw)
    }
  }

  resolveEffectiveValue(
    field: Extract<SheetField, { type: 'track' | 'scalar' }>,
    raw: unknown,
    evaluatedValue: number
  ): number {
    if (field.type !== 'track') return evaluatedValue
    const inputValue = this.trackInputValue(field, raw)
    // min/max の視覚 cap は front の gauge の塗りと checkboxes のチェック数だけで、数値表示は raw の超過をそのまま出す。
    return inputValue ?? evaluatedValue
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
        throw new NonFiniteTrackInputException({
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
        throw new NonFiniteTrackInputException({
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
      throw new NonFiniteTrackInputException({
        kind: 'track-input',
        fieldUid: field.uid,
        label: field.label,
        inputLocation: 'parts 合計',
        result
      })
    }
    return total
  }

  private assertExistingTrackInputIsRepairable(field: Extract<SheetField, { type: 'track' }>, value: unknown): void {
    try {
      this.trackInputValue(field, value)
    } catch (error) {
      // 既存値の非有限は利用者が修復できるが、非数値 parts は修復経路がないため 422 を再送出する。
      if (error instanceof NonFiniteTrackInputException) {
        return
      }
      throw error
    }
  }

  private trackFields(): Array<Extract<SheetField, { type: 'track' }>> {
    return this.template.sections.flatMap((section) =>
      section.fields.filter((field): field is Extract<SheetField, { type: 'track' }> => field.type === 'track')
    )
  }
}
