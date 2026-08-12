import type { ErrorEnvelope } from '@trpg/api-contract'

export const GENERIC_NETWORK_ERROR_MESSAGE = '通信に失敗しました。接続を確認して、もう一度お試しください。'

export function isErrorEnvelope(data: unknown): data is ErrorEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { success?: unknown }).success === false &&
    typeof (data as { error?: unknown }).error === 'string'
  )
}

export function getUpstreamResponse(error: unknown): { status: number; data: unknown } | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null
  const response = (error as { response?: { status?: unknown; data?: unknown } }).response
  if (!response || typeof response.status !== 'number' || response.data === undefined) return null
  return { status: response.status, data: response.data }
}

export function getResponseStatus(error: unknown): number | undefined {
  // status 専用の寛容な reader として、response.data の有無は問わない。
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: unknown } }).response?.status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}

export function errorEnvelopeMessages(data: ErrorEnvelope): string[] {
  const issueMessages = (data.issues?.map((issue) => issue.message) ?? []).filter((message) => message.length > 0)
  if (issueMessages.length > 0) return [...new Set(issueMessages)]

  const causeMessage = data.cause?.message
  if (Array.isArray(causeMessage) && causeMessage.every((message): message is string => typeof message === 'string')) {
    const causeMessages = causeMessage.filter((message) => message.length > 0)
    if (causeMessages.length > 0) return causeMessages
  }

  const detailMessages = (data.details?.map((detail) => detail.message) ?? []).filter((message) => message.length > 0)
  if (detailMessages.length > 0) return [...new Set(detailMessages)]

  if (data.error.length > 0) return [data.error]
  return [data.message]
}

export function extractApiErrorMessages(error: unknown): string[] {
  const upstreamResponse = getUpstreamResponse(error)
  if (upstreamResponse) {
    const { data } = upstreamResponse
    if (isErrorEnvelope(data)) {
      return errorEnvelopeMessages(data)
    }

    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message
      if (Array.isArray(message)) return message.map(String)
      if (typeof message === 'string')
        return message
          .split(';')
          .map((part) => part.trim())
          .filter(Boolean)
    }
  }

  if (error instanceof Error) return [error.message]
  return ['リクエストの処理中にエラーが発生しました']
}
