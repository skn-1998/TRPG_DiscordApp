import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { ErrorResponse } from '../dto/api-response.dto'
import { API_ERROR_RESPONSE_KEY, ApiErrorResponseMeta } from './api-error-response.decorator'
import { ApiError } from './api-error'
import { getHttpExceptionMessage } from './http-exception-message'
import { AppConfigService } from '../../config/config.service'

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
 *  2. それ以外の HttpException
 *     → status = HttpException.getStatus(), label = 既定値, error = HttpException の response/message。
 *  3. 非 HttpException（素の Error 等 = 変換前の catch ブロック相当）
 *     → handler が渡る host（テスト等）では @ApiErrorResponse(status, label) メタを fallback として適用。
 *       error = thrownError.message。これは変換前の
 *       ApiResponseUtil.error(res, error, status, label) と一致。
 *  4. handler またはメタが無い場合
 *     → ApiResponseUtil.error の既定値（status=500, label='エラーが発生しました'）にフォールバック。
 *
 * Nest の例外フィルタ経路では ExecutionContextHost の handler が常に null のため、
 * @ApiErrorResponse メタは本番では参照されず、非 HttpException は常に
 * 500 / 'エラーが発生しました' の既定になる。メタ参照コードは handler が渡る host
 * （テスト等）向けの後方互換として意図的に残置する。
 *
 * errorMessage / stack の扱いは ApiResponseUtil.error と同一。
 */
@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: AppConfigService
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    // HTTP コンテキストでは host は ExecutionContext 互換で getHandler() を持つ
    const handler =
      typeof (host as ExecutionContext).getHandler === 'function' ? (host as ExecutionContext).getHandler() : undefined

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
        undefined,
        undefined,
        stack,
        requestId,
        includeStack
      )
      res.status(exception.getStatus()).json(response)
      return
    }

    if (exception instanceof HttpException) {
      const response = new ErrorResponse(
        getHttpExceptionMessage(exception),
        'エラーが発生しました',
        undefined,
        undefined,
        exception.stack,
        requestId,
        includeStack
      )
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

    const response = new ErrorResponse(errorMessage, label, undefined, undefined, stack, requestId, includeStack)
    res.status(status).json(response)
  }
}
