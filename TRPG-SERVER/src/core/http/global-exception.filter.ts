import { ArgumentsHost, Catch, HttpException, Injectable, Logger, type Provider } from '@nestjs/common'
import { APP_FILTER, BaseExceptionFilter } from '@nestjs/core'
import type { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { AppConfigService } from '../../config/config.service'
import { DEFAULT_ERROR_RESPONSE_MESSAGE, ErrorResponse } from '../dto/api-response.dto'
import { ApiError } from './api-error'
import { getHttpExceptionMessage } from './http-exception-message'

const UNAVAILABLE_EXCEPTION_DIAGNOSTIC = '[diagnostic unavailable]'

type ExceptionDiagnostics = {
  name: string
  message: string
  stack?: string
}

const extractExceptionDiagnostics = (exception: unknown): ExceptionDiagnostics => {
  const fallbackName = exception === null ? 'null' : typeof exception

  try {
    if (exception instanceof Error) {
      return {
        name: exception.name,
        message: exception.message,
        stack: exception.stack
      }
    }

    return {
      name: fallbackName,
      message: String(exception)
    }
  } catch {
    return {
      name: fallbackName,
      message: UNAVAILABLE_EXCEPTION_DIAGNOSTIC
    }
  }
}

/**
 * 未知例外をクライアントへ返す際の固定文言。
 *
 * Nest 既定の "Internal server error" と同じ開示水準を保つため、
 * raw の exception.message はレスポンスへ載せない。
 */
export const GLOBAL_INTERNAL_ERROR_MESSAGE = 'サーバー内部でエラーが発生しました'

/**
 * アプリ全体の最終例外境界。
 *
 * 例外は次の3分岐で処理する。
 * 1. Express/http-errors は BaseExceptionFilter へ委譲し、Nest 既定形を維持する。
 * 2. HttpException は ErrorResponse 封筒へ整形し、ValidationPipe の message 配列は details[] に保持する。
 * 3. 未知例外は内部診断を隠した固定 500 封筒へ整形する。
 *
 * sheet 422 の issues[] や 409 の cause.conflicts は controller-scoped filter が保護する。
 * 局所 filter がない controller の HttpException だけが本 filter の封筒化対象になる。
 *
 * 委譲判定または BaseExceptionFilter 内で accessor 等の二次例外が起きた場合は、
 * Nest 既定との一致より応答の終端を優先し、未知例外用の固定 500 封筒へフォールスルーする。
 *
 * 最終境界自身が throw して元例外を隠さないことが不変条件。未知値の診断抽出とログ出力は
 * fallback または握りつぶしで必ず応答処理へ制御を戻す。
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  constructor(private readonly configService: AppConfigService) {
    super()
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    let delegationFailureDiagnostics: ExceptionDiagnostics | undefined

    try {
      if (this.isHttpError(exception) && !(exception instanceof HttpException)) {
        super.catch(exception, host)
        return
      }

      if (exception instanceof HttpException) {
        const res = host.switchToHttp().getResponse<Response>()
        const requestId = uuidv4()
        const includeStack = this.configService.get('app.environment') === 'development'

        if (exception instanceof ApiError) {
          const payload = exception.errorPayload
          const errorMessage = payload instanceof Error ? payload.message : String(payload)
          const stack = payload instanceof Error ? payload.stack : undefined

          const response = new ErrorResponse(
            errorMessage,
            exception.label,
            exception.errorCode,
            undefined,
            stack,
            requestId,
            includeStack
          )
          res.status(exception.getStatus()).json(response)
          return
        }

        const exceptionResponse = exception.getResponse()
        const messages =
          typeof exceptionResponse === 'object' &&
          exceptionResponse !== null &&
          'message' in exceptionResponse &&
          Array.isArray(exceptionResponse.message) &&
          exceptionResponse.message.every((message): message is string => typeof message === 'string')
            ? exceptionResponse.message
            : undefined
        const details = messages?.map((message) => ({ message }))
        const response = new ErrorResponse(
          getHttpExceptionMessage(exception),
          DEFAULT_ERROR_RESPONSE_MESSAGE,
          undefined,
          details,
          exception.stack,
          requestId,
          includeStack
        )
        res.status(exception.getStatus()).json(response)
        return
      }
    } catch (delegationFailure) {
      delegationFailureDiagnostics = extractExceptionDiagnostics(delegationFailure)
    }

    const requestId = uuidv4()
    const diagnostics = extractExceptionDiagnostics(exception)
    const delegationFailureLog = delegationFailureDiagnostics
      ? ` delegationFailureName=${delegationFailureDiagnostics.name} delegationFailureMessage=${delegationFailureDiagnostics.message}`
      : ''

    try {
      this.logger.error(
        `requestId=${requestId} name=${diagnostics.name} message=${diagnostics.message}${delegationFailureLog}`,
        diagnostics.stack ?? delegationFailureDiagnostics?.stack
      )
    } catch {
      // 最終例外境界ではログ基盤の障害よりクライアント応答の終端を優先する。
    }

    const res = host.switchToHttp().getResponse<Response>()
    if (res.headersSent) {
      res.end()
      return
    }

    const includeStack = this.configService.get('app.environment') === 'development'
    const response = new ErrorResponse(
      GLOBAL_INTERNAL_ERROR_MESSAGE,
      DEFAULT_ERROR_RESPONSE_MESSAGE,
      undefined,
      undefined,
      diagnostics.stack,
      requestId,
      includeStack
    )

    res.status(500).json(response)
  }
}

export const APP_GLOBAL_EXCEPTION_FILTER_PROVIDER: Provider = {
  provide: APP_FILTER,
  useClass: GlobalExceptionFilter
}
