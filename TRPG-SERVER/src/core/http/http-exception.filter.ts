import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable } from '@nestjs/common'
import { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_ERROR_RESPONSE_MESSAGE, ErrorResponse } from '../dto/api-response.dto'
import { ApiError } from './api-error'
import { getHttpExceptionMessage } from './http-exception-message'
import { AppConfigService } from '../../config/config.service'

/**
 * HttpException をエラーレスポンスへ整形する controller-scoped filter。
 *
 * 捕捉した例外を ApiResponseUtil.error と完全に同一の ErrorResponse
 * （= new ErrorResponse(errorMessage, label, errorCode, undefined, stack, requestId)）に整形する。
 *
 * status / label の決定（変換前の挙動保存）:
 *  1. ApiError の場合（個別分岐で明示的に status/label を指定していた箇所、例: 404 not found）
 *     → status = ApiError.status, label = ApiError.label, error = ApiError.errorPayload,
 *       errorCode = ApiError.errorCode（未指定時は wire に含めない）
 *       これは変換前の ApiResponseUtil.error(res, errorPayload, status, label) と一致。
 *  2. それ以外の HttpException
 *     → status = HttpException.getStatus(), label = 既定値, error = HttpException の response/message。
 *
 * 非 HttpException のうち Express/http-errors 形は GlobalExceptionFilter から
 * BaseExceptionFilter へ委譲され、Nest 既定形で返る。それ以外は GlobalExceptionFilter が
 * 内部診断を隠した固定文言の 500 ErrorResponse 封筒へ整形する。
 *
 * errorMessage / stack の扱いは ApiResponseUtil.error と同一。
 */
@Injectable()
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter<HttpException> {
  constructor(private readonly configService: AppConfigService) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    const requestId = uuidv4()
    // P1-C: 旧 ErrorResponse(DTO) 内 `process.env.NODE_ENV==='development'` を DI 境界（本 filter）へ移管。
    // app.environment は env.NODE_ENV（configuration.ts）と等価＝挙動不変。
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

    const response = new ErrorResponse(
      getHttpExceptionMessage(exception),
      DEFAULT_ERROR_RESPONSE_MESSAGE,
      undefined,
      undefined,
      exception.stack,
      requestId,
      includeStack
    )
    res.status(exception.getStatus()).json(response)
    return
  }
}
