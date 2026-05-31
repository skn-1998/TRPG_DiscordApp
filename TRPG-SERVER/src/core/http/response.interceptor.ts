import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, map } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import { SuccessResponse } from '../dto/api-response.dto'
import { RESPONSE_MESSAGE_KEY } from './response-message.decorator'
import { SKIP_RESPONSE_WRAPPER_KEY } from './skip-response-wrapper.decorator'

/**
 * 成功レスポンス封筒化インターセプタ。
 *
 * ハンドラの戻り値を ApiResponseUtil.success と完全に同一の SuccessResponse
 * （= new SuccessResponse(data, message, meta, requestId), requestId=uuidv4()）でラップする。
 *
 * - message      : @ResponseMessage のメタデータ、無ければ '成功'（ApiResponseUtil.success の既定値と一致）
 * - meta         : 付与しない（変換前の対象エンドポイントはいずれも meta 未使用）
 * - requestId    : uuidv4()（変換前と同一）
 *
 * @SkipResponseWrapper が付いたハンドラ、および既に SuccessResponse の場合は素通しする。
 * HTTP status は @HttpCode / 既定の Nest 規則（GET/POST=200, Post 既定201 等）に委ねる。
 * 対象 2 controller では全エンドポイント 200 のため、必要箇所に @HttpCode(200) を付与して保存する。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponse<T> | T> {
    const handler = context.getHandler()

    const skip = this.reflector.get<boolean>(SKIP_RESPONSE_WRAPPER_KEY, handler)
    if (skip) {
      return next.handle()
    }

    const message = this.reflector.get<string>(RESPONSE_MESSAGE_KEY, handler) ?? '成功'

    return next.handle().pipe(
      map((data) => {
        // 既に封筒（SuccessResponse）ならそのまま返す（二重ラップ防止）
        if (data instanceof SuccessResponse) {
          return data
        }
        return new SuccessResponse<T>(data, message, undefined, uuidv4())
      })
    )
  }
}
