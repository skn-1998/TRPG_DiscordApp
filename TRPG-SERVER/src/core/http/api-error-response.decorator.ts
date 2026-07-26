import { SetMetadata } from '@nestjs/common'

/**
 * エラー時のフォールバック status / label を指定するデコレータ。
 *
 * 変換前は「ハンドラ全体を try/catch し、捕捉したエラーを固定 status + 固定 label で
 * ApiResponseUtil.error(res, error, status, label) として返す」という粗い形だった。
 * その「固定 status + 固定 label」を宣言的に保持するためのメタデータ。
 *
 * Nest の例外フィルタ経路では ExecutionContextHost の handler が常に null のため、
 * @ApiErrorResponse メタは本番では参照されない。非 HttpException は常に
 * 500 / 'エラーが発生しました' の既定になり、メタ参照コードは handler が渡る host
 * （テスト等）向けの後方互換として意図的に残置している。
 */
export interface ApiErrorResponseMeta {
  /** ApiResponseUtil.error の第3引数 status に相当（変換前のエンドポイント固定値） */
  status: number
  /** ApiResponseUtil.error の第4引数 message（= ErrorResponse の label）に相当 */
  label: string
}

export const API_ERROR_RESPONSE_KEY = 'response:apiError'

/**
 * @deprecated 本番の例外フィルタ経路では handler=null のため一切適用されない。新規使用禁止。既存は段階的に撤去する。
 */
export const ApiErrorResponse = (status: number, label: string): MethodDecorator =>
  SetMetadata(API_ERROR_RESPONSE_KEY, { status, label } satisfies ApiErrorResponseMeta)
