import { SetMetadata } from '@nestjs/common'

/**
 * エラー時のフォールバック status / label を指定するデコレータ。
 *
 * 変換前は「ハンドラ全体を try/catch し、捕捉したエラーを固定 status + 固定 label で
 * ApiResponseUtil.error(res, error, status, label) として返す」という粗い形だった。
 * その「固定 status + 固定 label」を宣言的に保持するためのメタデータ。
 *
 * OV5-1（第4群スライス1）でメタを読む実装は削除済み。
 * 現在このメタはどの経路からも参照されない。
 * デコレータとメタデータの撤去は第5群で行う。
 */
export interface ApiErrorResponseMeta {
  /** ApiResponseUtil.error の第3引数 status に相当（変換前のエンドポイント固定値） */
  status: number
  /** ApiResponseUtil.error の第4引数 message（= ErrorResponse の label）に相当 */
  label: string
}

export const API_ERROR_RESPONSE_KEY = 'response:apiError'

/**
 * @deprecated どの経路でも参照されない無効メタ。新規使用禁止。既存は第5群で段階的に撤去する。
 */
export const ApiErrorResponse = (status: number, label: string): MethodDecorator =>
  SetMetadata(API_ERROR_RESPONSE_KEY, { status, label } satisfies ApiErrorResponseMeta)
