import { HttpException } from '@nestjs/common'

/**
 * HttpException の response からクライアント向けメッセージを取り出す。
 *
 * Nest の HttpExceptionBodyMessage（string | string[] | number）に合わせ、number は String 化し、
 * validation error などの string[] は単一の error フィールドで返せるよう ', ' で連結する。
 */
export function getHttpExceptionMessage(exception: HttpException): string {
  const response = exception.getResponse()
  if (typeof response === 'string') {
    return response
  }
  if (typeof response === 'object' && response !== null && 'message' in response) {
    const message = response.message
    if (typeof message === 'string') {
      return message
    }
    if (typeof message === 'number') {
      return String(message)
    }
    if (Array.isArray(message)) {
      return message.map(String).join(', ')
    }
  }
  return exception.message
}
