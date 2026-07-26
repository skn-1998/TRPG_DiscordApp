import { HttpException } from '@nestjs/common'

/**
 * envelope（ErrorResponse）の status / label / error を明示的に運ぶ例外。
 *
 * 変換前に「同一ハンドラ内で catch とは別の status / label を直接指定して
 * ApiResponseUtil.error(res, error, status, label) を返していた分岐」
 * （例: findOne / update の 404）を再現するために使う。
 *
 * HttpExceptionFilter はこの例外を最優先で扱い、
 * - HTTP status     = status
 * - ErrorResponse.message(label) = label
 * - ErrorResponse.error          = errorPayload（変換前に error 引数へ渡していた値）
 * として整形する。errorPayload には変換前と同じく Error でも文字列でも渡せる。
 */
export class ApiError extends HttpException {
  /** 変換前に ApiResponseUtil.error の第4引数(message=label)へ渡していた値 */
  readonly label: string
  /** 変換前に ApiResponseUtil.error の第2引数(error)へ渡していた値 */
  readonly errorPayload: unknown

  constructor(status: number, label: string, errorPayload: unknown) {
    super(label, status)
    this.label = label
    this.errorPayload = errorPayload
  }
}
