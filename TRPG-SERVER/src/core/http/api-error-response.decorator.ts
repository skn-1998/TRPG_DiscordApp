import { SetMetadata } from '@nestjs/common'

/**
 * エラー時のフォールバック status / label を指定するデコレータ。
 *
 * 変換前は「ハンドラ全体を try/catch し、捕捉したエラーを固定 status + 固定 label で
 * ApiResponseUtil.error(res, error, status, label) として返す」という粗い形だった。
 * その「固定 status + 固定 label」を宣言的に保持するためのメタデータ。
 *
 * HttpExceptionFilter は、ハンドラから throw された例外が status / label を
 * 明示的に運ぶ ApiError でない場合に、このメタデータを fallback として適用する。
 */
export interface ApiErrorResponseMeta {
  /** ApiResponseUtil.error の第3引数 status に相当（変換前のエンドポイント固定値） */
  status: number
  /** ApiResponseUtil.error の第4引数 message（= ErrorResponse の label）に相当 */
  label: string
}

export const API_ERROR_RESPONSE_KEY = 'response:apiError'

export const ApiErrorResponse = (status: number, label: string): MethodDecorator =>
  SetMetadata(API_ERROR_RESPONSE_KEY, { status, label } satisfies ApiErrorResponseMeta)
