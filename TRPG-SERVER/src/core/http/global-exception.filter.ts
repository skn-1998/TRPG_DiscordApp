import { ArgumentsHost, Catch, HttpException, Injectable, Logger, type Provider } from '@nestjs/common'
import { APP_FILTER, BaseExceptionFilter } from '@nestjs/core'
import type { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { AppConfigService } from '../../config/config.service'
import { DEFAULT_ERROR_RESPONSE_MESSAGE, ErrorResponse } from '../dto/api-response.dto'

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
 * HttpException と Express/http-errors は BaseExceptionFilter へ委譲し、sheet 422 の issues[]、
 * 409 の conflicts[]、ValidationPipe 400 の message 配列、名前付き例外や body-parser の
 * { message, error?, statusCode } を Nest 既定の直列化のまま保存する。
 *
 * /character prefix は controller-scoped filter で封筒へ統一済み。
 * /sheet-templates など残る非封筒面との互換性のため、ここでは HttpException の委譲を維持する。
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
      if (exception instanceof HttpException || this.isHttpError(exception)) {
        super.catch(exception, host)
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
