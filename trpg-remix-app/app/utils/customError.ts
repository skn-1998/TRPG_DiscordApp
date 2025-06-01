export function CustomError(error: unknown | null | undefined): string {
  if (error instanceof Error) {
    return error.message
  } else if (error && typeof error === 'object') {
    // Axiosエラーの場合
    if ('response' in error) {
      const axiosErr = error as { response?: { status?: number; data?: unknown; statusText?: string } }
      const status = axiosErr.response?.status
      const data = axiosErr.response?.data
      const statusText = axiosErr.response?.statusText

      if (data && typeof data === 'object' && 'message' in data) {
        return `HTTP ${status}: ${data.message}`
      } else if (statusText) {
        return `HTTP ${status}: ${statusText}`
      } else {
        return `HTTP ${status}: Request failed`
      }
    }
    // その他のオブジェクトエラー
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
    return JSON.stringify(error)
  } else {
    return 'Unknown Error'
  }
}
