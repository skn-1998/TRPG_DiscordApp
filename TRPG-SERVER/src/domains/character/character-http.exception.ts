import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  AuthenticationErrorResponse,
  DEFAULT_ERROR_RESPONSE_MESSAGE,
  ErrorResponse,
  NotFoundErrorResponse
} from '../../core/dto/api-response.dto'
import { getHttpExceptionMessage } from '../../core/http/http-exception-message'
import { AppConfigService } from '../../config/config.service'

/**
 * character コントローラ専用のエラー封筒化フィルタ。
 *
 * 変換前の character.controller は汎用の ApiResponseUtil.error ではなく、
 * 専用ヘルパ（authenticationError / notFoundError / internalServerError）を使っており、
 * これらは ErrorResponse のサブクラス（errorCode・固定 message を持つ）を生成していた。
 *
 * core/http の共通 HttpExceptionFilter は汎用 ErrorResponse しか作れず、
 * errorCode・専用 message を再現できない。
 * そこで character スコープでのみ使う最小フィルタを追加し、
 * 変換前と完全一致の envelope（success/status/message/error/errorCode）を保存する。
 *
 * - CharacterAuthenticationException → 401 / AuthenticationErrorResponse
 *   （変換前 ApiResponseUtil.authenticationError(res, message) と一致）
 * - CharacterNotFoundException      → 404 / NotFoundErrorResponse
 *   （変換前 ApiResponseUtil.notFoundError(res, resource) と一致）
 * - その他の HttpException          → getStatus() / ErrorResponse
 * - 非 HttpException                 → 本フィルタでは捕捉せず GlobalExceptionFilter へ委譲
 *
 * グローバル登録はせず、character.controller の @UseFilters でのみ適用する。
 */
@Injectable()
@Catch(HttpException)
export class CharacterHttpExceptionFilter implements ExceptionFilter<HttpException> {
  constructor(private readonly configService: AppConfigService) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const requestId = uuidv4()
    // P1-C: 旧 ErrorResponse(DTO) 内の dev 判定を DI 境界（本 filter）へ移管（app.environment===NODE_ENV・挙動不変）。
    const includeStack = this.configService.get('app.environment') === 'development'

    if (exception instanceof CharacterAuthenticationException) {
      // 変換前: ApiResponseUtil.authenticationError(res, message)
      const response = new AuthenticationErrorResponse(exception.userMessage, requestId)
      res.status(HttpStatus.UNAUTHORIZED).json(response)
      return
    }

    if (exception instanceof CharacterNotFoundException) {
      // 変換前: ApiResponseUtil.notFoundError(res, resource)
      const response = new NotFoundErrorResponse(exception.resource, requestId)
      res.status(HttpStatus.NOT_FOUND).json(response)
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

/**
 * 認証欠落（変換前の UnauthorizedException → authenticationError）を表す例外。
 * userMessage は AuthenticationErrorResponse の error フィールドへ反映される。
 */
export class CharacterAuthenticationException extends HttpException {
  readonly userMessage: string

  constructor(userMessage: string) {
    super(userMessage, HttpStatus.UNAUTHORIZED)
    this.userMessage = userMessage
  }
}

/**
 * リソース未発見（変換前の notFoundError(res, resource)）を表す例外。
 * resource は NotFoundErrorResponse の `${resource}が見つかりません` に反映される。
 */
export class CharacterNotFoundException extends HttpException {
  readonly resource: string

  constructor(resource: string) {
    super(`${resource}が見つかりません`, HttpStatus.NOT_FOUND)
    this.resource = resource
  }
}
