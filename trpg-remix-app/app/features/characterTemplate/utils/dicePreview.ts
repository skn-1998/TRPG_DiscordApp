import type { DicePreviewRequest, DicePreviewResponse } from '@trpg/api-contract'
import { interpolateNotation } from '@trpg/sheet-engine'
import type { EvaluationResult, SheetTemplate } from '@trpg/sheet-engine'

export const DICE_PREVIEW_NETWORK_ERROR_CODE = 'DICE_PREVIEW_NETWORK_ERROR'
export const DICE_PREVIEW_INVALID_RESPONSE_CODE = 'DICE_PREVIEW_INVALID_RESPONSE'
export const NOTATION_INTERPOLATION_ERROR_MESSAGE = 'ロール式の参照を解決できません。参照先の入力値を確認してください。'

type DicePreviewRequestBuildResult = { ok: true; request: DicePreviewRequest } | { ok: false; error: string }

export type DicePreviewActionResult = { ok: true; result: DicePreviewResponse } | { ok: false; error: string }

interface BuildDicePreviewRequestInput {
  template: SheetTemplate
  evaluated: EvaluationResult | null
  notation: string
  gameSystemId?: string
}

interface DicePreviewErrorInput {
  status?: number
  message?: unknown
  code?: unknown
}

export function buildDicePreviewRequest({
  template,
  evaluated,
  notation,
  gameSystemId
}: BuildDicePreviewRequestInput): DicePreviewRequestBuildResult {
  if (!evaluated) {
    return { ok: false, error: NOTATION_INTERPOLATION_ERROR_MESSAGE }
  }

  try {
    const interpolated = interpolateNotation({ template, evaluated, notation })
    const request: DicePreviewRequest = gameSystemId
      ? { notation: interpolated.notation, gameSystemId }
      : { notation: interpolated.notation }
    return { ok: true, request }
  } catch {
    return { ok: false, error: NOTATION_INTERPOLATION_ERROR_MESSAGE }
  }
}

export function classifyDicePreviewError({ status, message, code }: DicePreviewErrorInput): string {
  if (code === DICE_PREVIEW_NETWORK_ERROR_CODE || status == null) {
    return 'ダイスロールサーバーに接続できませんでした。通信状態を確認して再試行してください。'
  }

  const details = extractErrorMessage(message)
  if (status === 400) {
    return appendDetails('ダイス記法が不正です。', details)
  }
  if (status === 422) {
    return appendDetails('BCDice がこのダイス記法を受理できませんでした。', details)
  }
  if (status === 429) {
    return appendDetails('ロール回数の上限に達しました。少し待ってから再試行してください。', details)
  }
  return appendDetails('ダイスロールに失敗しました。', details)
}

export function readDicePreviewActionData(data: unknown): DicePreviewActionResult {
  if (isDicePreviewResponse(data)) {
    return { ok: true, result: data }
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: classifyDicePreviewError({}) }
  }

  const errorData = data as Record<string, unknown>
  return {
    ok: false,
    error: classifyDicePreviewError({
      status: typeof errorData.statusCode === 'number' ? errorData.statusCode : undefined,
      message: errorData.message,
      code: errorData.code
    })
  }
}

function isDicePreviewResponse(value: unknown): value is DicePreviewResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.total === 'number' && Number.isFinite(candidate.total) && typeof candidate.details === 'string'
  )
}

function extractErrorMessage(message: unknown): string {
  if (Array.isArray(message)) return message.map(String).join(' / ')
  return typeof message === 'string' ? message : ''
}

function appendDetails(prefix: string, details: string): string {
  return details ? `${prefix} ${details}` : prefix
}
