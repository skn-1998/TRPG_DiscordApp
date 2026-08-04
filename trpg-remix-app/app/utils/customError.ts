import { errorEnvelopeMessages, isErrorEnvelope } from '../lib/api-response.util'

export function CustomError(error: unknown | null | undefined): string {
  if (error && typeof error === 'object') {
    const response = 'response' in error ? error.response : undefined
    const isAxiosError =
      ('isAxiosError' in error && error.isAxiosError === true) ||
      (typeof response === 'object' && response !== null && 'status' in response)

    if (isAxiosError) {
      const axiosResponse = response as { status?: number; data?: unknown; statusText?: string } | undefined
      const status = axiosResponse?.status
      const data = axiosResponse?.data
      const statusText = axiosResponse?.statusText

      if (isErrorEnvelope(data)) {
        return `HTTP ${status}: ${errorEnvelopeMessages(data).join(' / ')}`
      } else if (data && typeof data === 'object' && 'message' in data) {
        return `HTTP ${status}: ${data.message}`
      } else if (statusText) {
        return `HTTP ${status}: ${statusText}`
      } else {
        return `HTTP ${status}: Request failed`
      }
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    // その他のオブジェクトエラー
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
    return JSON.stringify(error)
  }

  return 'Unknown Error'
}
