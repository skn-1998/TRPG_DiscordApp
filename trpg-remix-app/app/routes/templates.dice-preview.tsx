import { json, type ActionFunctionArgs } from '@remix-run/node'
import { dicePreviewRequestSchema, dicePreviewResponseSchema } from '@trpg/api-contract'
import { getJwtFromRequest } from '~/features/auth/api/auth.service'
import {
  DICE_PREVIEW_INVALID_RESPONSE_CODE,
  DICE_PREVIEW_NETWORK_ERROR_CODE
} from '~/features/characterTemplate/utils/dicePreview'
import { apiClient, clearServerRequestContext, setServerRequestContext, withJwt } from '~/lib/api-client'

const DICE_PREVIEW_PATH = '/dice-roll/preview'

export async function action({ request }: ActionFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  if (!jwt) {
    return json({ statusCode: 401, message: '認証が必要です', error: 'Unauthorized' }, { status: 401 })
  }

  setServerRequestContext(request, jwt)
  try {
    const parsedRequest = dicePreviewRequestSchema.safeParse(await readJsonBody(request))
    if (!parsedRequest.success) {
      return json(
        {
          statusCode: 400,
          message: parsedRequest.error.issues.map((issue) => issue.message),
          error: 'Bad Request'
        },
        { status: 400 }
      )
    }

    const response = await apiClient.post<unknown>(DICE_PREVIEW_PATH, parsedRequest.data, withJwt(jwt))
    const parsedResponse = dicePreviewResponseSchema.safeParse(response.data)
    if (!parsedResponse.success) {
      return json(
        {
          statusCode: 502,
          message: 'ダイスロールサーバーの応答形式が不正です',
          error: 'Bad Gateway',
          code: DICE_PREVIEW_INVALID_RESPONSE_CODE
        },
        { status: 502 }
      )
    }

    return json(parsedResponse.data)
  } catch (error) {
    const upstreamResponse = getUpstreamResponse(error)
    if (upstreamResponse) {
      return json(upstreamResponse.data, { status: upstreamResponse.status })
    }

    return json(
      {
        statusCode: 502,
        message: 'ダイスロールサーバーに接続できませんでした',
        error: 'Bad Gateway',
        code: DICE_PREVIEW_NETWORK_ERROR_CODE
      },
      { status: 502 }
    )
  } finally {
    clearServerRequestContext()
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

function getUpstreamResponse(error: unknown): { status: number; data: unknown } | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null
  const response = (error as { response?: { status?: unknown; data?: unknown } }).response
  if (!response || typeof response.status !== 'number' || response.data === undefined) return null
  return { status: response.status, data: response.data }
}
