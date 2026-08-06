import type { ErrorEnvelope } from '@trpg/api-contract'

export function isErrorEnvelope(data: unknown): data is ErrorEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { success?: unknown }).success === false &&
    typeof (data as { error?: unknown }).error === 'string'
  )
}

export function getResponseStatus(error: unknown): number | undefined {
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
