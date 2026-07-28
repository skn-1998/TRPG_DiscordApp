import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import type { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { buildSheetErrorEnvelope, type SheetErrorEnvelopeExtensions } from './services/track-range.policy'

const FALLBACK_REQUEST_ID = '00000000-0000-0000-0000-000000000000'
const FALLBACK_HTTP_ERROR_MESSAGE = 'HTTP request failed'
const HTTP_EXCEPTION_BODY_DENY_LIST = new Set(['message', 'statusCode', 'error', 'issues'])

type HttpExceptionBody = Readonly<Record<string, unknown>>

interface MappedSheetHttpException {
  error: string
  extensions: SheetErrorEnvelopeExtensions
}

/**
 * CharacterSheetController の HttpException だけを共通エラー封筒へ写像する。
 *
 * body.statusCode と body.error の標準 reason phrase（"Bad Request" など）は封筒へ載せない。
 * HTTP status line と完全に冗長であり、front は error.response.status を読むためである。
 *
 * 非 HttpException は捕捉せず、APP_FILTER の GlobalExceptionFilter を最終境界として使う。
 */
@Catch(HttpException)
export class CharacterSheetHttpExceptionFilter implements ExceptionFilter<HttpException> {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const status = this.safeStatus(exception)
    const metadata = {
      timestamp: Date.now(),
      requestId: this.createRequestId()
    }

    let envelope
    try {
      const mapped = this.mapException(exception)
      envelope = buildSheetErrorEnvelope(mapped.error, mapped.extensions, metadata)
    } catch {
      // HttpException body の accessor が壊れていても、filter から二次例外を投げない。
      envelope = buildSheetErrorEnvelope(this.safeExceptionMessage(exception), {}, metadata)
    }

    this.send(host, status, envelope)
  }

  private mapException(exception: HttpException): MappedSheetHttpException {
    const body = exception.getResponse()
    if (typeof body === 'string') {
      return { error: body, extensions: {} }
    }
    if (!this.isRecord(body)) {
      return { error: this.safeExceptionMessage(exception), extensions: {} }
    }

    return {
      error: this.errorMessage(body.message, exception),
      extensions: {
        ...(Array.isArray(body.issues)
          ? { issues: body.issues as NonNullable<SheetErrorEnvelopeExtensions['issues']> }
          : {}),
        ...this.causeExtension(body)
      }
    }
  }

  private causeExtension(body: HttpExceptionBody): Pick<SheetErrorEnvelopeExtensions, 'cause'> {
    const cause: Record<string, unknown> = {}

    // ValidationPipe の配列は error 用に結合しても、元の順序と要素を cause に残す。
    if (Array.isArray(body.message)) {
      cause.message = body.message
    }

    for (const key of Object.keys(body)) {
      if (HTTP_EXCEPTION_BODY_DENY_LIST.has(key)) continue
      Object.defineProperty(cause, key, {
        configurable: true,
        enumerable: true,
        value: body[key],
        writable: true
      })
    }

    return Object.keys(cause).length === 0 ? {} : { cause }
  }

  private errorMessage(message: unknown, exception: HttpException): string {
    if (typeof message === 'string') {
      return message
    }
    if (Array.isArray(message)) {
      const messages = message.map((item) => String(item))
      if (messages.length > 0) {
        return messages.join('; ')
      }
    }
    return this.safeExceptionMessage(exception)
  }

  private safeStatus(exception: HttpException): number {
    try {
      return exception.getStatus()
    } catch {
      return 500
    }
  }

  private safeExceptionMessage(exception: HttpException): string {
    try {
      return exception.message || FALLBACK_HTTP_ERROR_MESSAGE
    } catch {
      return FALLBACK_HTTP_ERROR_MESSAGE
    }
  }

  private createRequestId(): string {
    try {
      return uuidv4()
    } catch {
      return FALLBACK_REQUEST_ID
    }
  }

  private send(host: ArgumentsHost, status: number, envelope: ReturnType<typeof buildSheetErrorEnvelope>): void {
    let response: Response | undefined
    try {
      response = host.switchToHttp().getResponse<Response>()
      if (response.headersSent) {
        response.end()
        return
      }
      response.status(status).json(envelope)
    } catch {
      // adapter / serialization 障害でも filter から二次例外を投げない。
      try {
        response?.end()
      } catch {
        // 応答 adapter 自体が利用不能なら、これ以上安全に終端できない。
      }
    }
  }

  private isRecord(value: unknown): value is HttpExceptionBody {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
