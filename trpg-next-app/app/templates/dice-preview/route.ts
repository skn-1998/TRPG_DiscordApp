import { dicePreviewRequestSchema, dicePreviewResponseSchema } from '@trpg/api-contract'
import { NextResponse } from 'next/server'
import {
  DICE_PREVIEW_INVALID_RESPONSE_CODE,
  DICE_PREVIEW_NETWORK_ERROR_CODE
} from '../../features/characterTemplate/utils/dicePreview'
import type { DicePreviewActionError } from '../../features/characterTemplate/utils/dicePreview'
import { apiClient } from '../../lib/api-client.server'
import { errorEnvelopeMessages, getUpstreamResponse, isErrorEnvelope } from '../../lib/api-response.util'
import { readJwt } from '../../lib/auth-guard.server'

const DICE_PREVIEW_PATH = '/dice-roll/preview'

export async function POST(request: Request): Promise<NextResponse> {
  const jwt = await readJwt()
  if (!jwt) {
    // JSON 契約を維持する Route Handler は、保護 page の requireJwt 規約の例外とする。
    return NextResponse.json<DicePreviewActionError>(
      { status: 401, messages: ['認証が必要です'] },
      { status: 401 }
    )
  }

  try {
    const parsedRequest = dicePreviewRequestSchema.safeParse(await readJsonBody(request))
    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          status: 400,
          messages: parsedRequest.error.issues.map((issue) => issue.message)
        } satisfies DicePreviewActionError,
        { status: 400 }
      )
    }

    const response = await apiClient.post<unknown>(DICE_PREVIEW_PATH, parsedRequest.data)
    const parsedResponse = dicePreviewResponseSchema.safeParse(response.data)
    if (!parsedResponse.success) {
      return NextResponse.json(
        {
          status: 502,
          messages: ['ダイスロールサーバーの応答形式が不正です'],
          errorCode: DICE_PREVIEW_INVALID_RESPONSE_CODE
        } satisfies DicePreviewActionError,
        { status: 502 }
      )
    }

    return NextResponse.json(parsedResponse.data, { status: 200 })
  } catch (error) {
    const upstreamResponse = getUpstreamResponse(error)
    if (upstreamResponse) {
      if (isErrorEnvelope(upstreamResponse.data)) {
        return NextResponse.json(
          {
            status: upstreamResponse.status,
            messages: errorEnvelopeMessages(upstreamResponse.data),
            ...(upstreamResponse.data.errorCode ? { errorCode: upstreamResponse.data.errorCode } : {})
          } satisfies DicePreviewActionError,
          { status: upstreamResponse.status }
        )
      }

      return NextResponse.json(
        {
          status: 502,
          messages: ['ダイスロールサーバーの応答形式が不正です'],
          errorCode: DICE_PREVIEW_INVALID_RESPONSE_CODE
        } satisfies DicePreviewActionError,
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        status: 502,
        messages: ['ダイスロールサーバーに接続できませんでした'],
        errorCode: DICE_PREVIEW_NETWORK_ERROR_CODE
      } satisfies DicePreviewActionError,
      { status: 502 }
    )
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}
