import { ArgumentsHost, Catch, ExceptionFilter, ExecutionContext, HttpStatus } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { ErrorResponse } from '../dto/api-response.dto'
import { API_ERROR_RESPONSE_KEY, ApiErrorResponseMeta } from './api-error-response.decorator'
import { ApiError } from './api-error'

/**
 * エラーレスポンス整形フィルタ。
 *
 * throw された例外を ApiResponseUtil.error と完全に同一の ErrorResponse
 * （= new ErrorResponse(errorMessage, label, errorCode, undefined, stack, requestId)）に整形する。
 *
 * status / label の決定（変換前の挙動保存）:
 *  1. ApiError の場合（個別分岐で明示的に status/label を指定していた箇所、例: 404 not found）
 *     → status = ApiError.status, label = ApiError.label, error = ApiError.errorPayload
 *       これは変換前の ApiResponseUtil.error(res, errorPayload, status, label) と一致。
 *  2. それ以外（素の Error 等 = 変換前の catch ブロック相当）
 *     → ハンドラの @ApiErrorResponse(status, label) メタを fallback として適用。
 *       error = thrownError.message。これは変換前の
 *       ApiResponseUtil.error(res, error, status, label) と一致。
 *  3. メタも無い場合（理論上は対象 controller では発生しない）
 *     → ApiResponseUtil.error の既定値（status=500, label='エラーが発生しました'）にフォールバック。
 *
 * errorMessage / stack の扱いは ApiResponseUtil.error と同一。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly reflector: Reflector) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    // HTTP コンテキストでは host は ExecutionContext 互換で getHandler() を持つ
    const handler =
      typeof (host as ExecutionContext).getHandler === 'function' ? (host as ExecutionContext).getHandler() : undefined

    const requestId = uuidv4()

    if (exception instanceof ApiError) {
      const payload = exception.errorPayload
      const errorMessage = payload instanceof Error ? payload.message : String(payload)
      const stack = payload instanceof Error ? payload.stack : undefined

      const response = new ErrorResponse(errorMessage, exception.label, undefined, undefined, stack, requestId)
      res.status(exception.getStatus()).json(response)
      return
    }

    // catch ブロック相当: @ApiErrorResponse メタから固定 status / label を取得
    const meta = handler
      ? this.reflector.get<ApiErrorResponseMeta | undefined>(API_ERROR_RESPONSE_KEY, handler)
      : undefined

    const status = meta?.status ?? HttpStatus.INTERNAL_SERVER_ERROR
    const label = meta?.label ?? 'エラーが発生しました'

    const errorMessage = exception instanceof Error ? exception.message : String(exception)
    const stack = exception instanceof Error ? exception.stack : undefined

    const response = new ErrorResponse(errorMessage, label, undefined, undefined, stack, requestId)
    res.status(status).json(response)
  }
}
