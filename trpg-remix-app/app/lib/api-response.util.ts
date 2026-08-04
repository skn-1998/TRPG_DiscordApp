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

const normalizeErrorMessage = (message: unknown): string | undefined => {
  if (typeof message === 'string') {
    return message
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(', ')
  }

  return undefined
}

/**
 * レスポンス処理ユーティリティ
 */
export class ApiResponseUtil {
  /**
   * エラーレスポンスを処理する
   * @param error axiosエラー
   * @returns エラーメッセージ
   */
  static handleError(error: unknown): string {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = error.response

      if (response && typeof response === 'object' && 'data' in response && response.data) {
        const errorData = response.data

        if (isErrorEnvelope(errorData)) {
          return errorEnvelopeMessages(errorData).join(' / ')
        }

        if (typeof errorData === 'object') {
          const data = errorData as { message?: unknown; error?: unknown }
          const message = normalizeErrorMessage(data.message)

          if (message) {
            return message
          }

          if (typeof data.error === 'string' && data.error) {
            return data.error
          }
        }

        return 'Unknown error occurred'
      }
    }

    if (error instanceof Error) {
      return error.message
    }

    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message
    }

    return 'Network error occurred'
  }
}
