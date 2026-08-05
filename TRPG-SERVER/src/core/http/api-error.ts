import { HttpException } from '@nestjs/common'

/**
 * envelope（ErrorResponse）の status / label / error を明示的に運ぶ例外。
 *
 * 変換前に「同一ハンドラ内で catch とは別の status / label を直接指定して
 * 汎用エラー封筒を返していた分岐」
 * （例: findOne / update の 404）を再現するために使う。
 *
 * GlobalExceptionFilter はこの例外を最優先で扱い、
 * - HTTP status     = status
 * - ErrorResponse.message(label) = label
 * - ErrorResponse.error          = errorPayload（変換前に error 引数へ渡していた値）
 * - ErrorResponse.errorCode      = errorCode（指定時のみ wire に現れる任意コード）
 * として整形する。errorPayload には変換前と同じく Error でも文字列でも渡せる。
 */
export class ApiError extends HttpException {
  /** 変換前のエラー封筒で message に設定していたラベル */
  readonly label: string
  /** 変換前のエラー封筒で error に設定していた値 */
  readonly errorPayload: unknown
  /** ErrorResponse へ伝播し、未指定時は wire に現れない任意のエラーコード */
  readonly errorCode?: string

  constructor(status: number, label: string, errorPayload: unknown, errorCode?: string) {
    super(label, status)
    this.label = label
    this.errorPayload = errorPayload
    this.errorCode = errorCode
  }
}
