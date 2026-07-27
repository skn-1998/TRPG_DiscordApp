import type { ErrorEnvelope } from '@trpg/api-contract'

export function isErrorEnvelope(data: unknown): data is ErrorEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { success?: unknown }).success === false &&
    typeof (data as { error?: unknown }).error === 'string'
  )
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
          if (errorData.error) {
            return errorData.error
          }

          if (errorData.message) {
            return errorData.message
          }

          return 'Unknown error occurred'
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
