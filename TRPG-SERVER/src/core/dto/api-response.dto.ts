import { IsBoolean, IsOptional, IsString, IsNumber, IsArray } from 'class-validator'
import type { SuccessEnvelope, ErrorEnvelope } from '@trpg/api-contract'

export const DEFAULT_ERROR_RESPONSE_MESSAGE = 'エラーが発生しました'

/**
 * API レスポンス基底クラス
 * すべてのAPIレスポンスの標準形式を定義
 */
export abstract class BaseApiResponse {
  @IsBoolean()
  readonly success: boolean

  @IsString()
  readonly message: string

  @IsNumber()
  readonly timestamp: number

  @IsOptional()
  @IsString()
  readonly requestId?: string

  constructor(success: boolean, message: string, requestId?: string) {
    this.success = success
    this.message = message
    this.timestamp = Date.now()
    this.requestId = requestId
  }
}

/**
 * 成功レスポンス
 * @trpg/api-contract の封筒型を implements しており、直列化形の乖離はコンパイルエラーになる（S5c で機械固定）
 */
export class SuccessResponse<T = any> extends BaseApiResponse implements SuccessEnvelope<T> {
  override readonly success: true

  readonly data: T

  @IsOptional()
  readonly meta?: {
    total?: number
    page?: number
    limit?: number
    hasNext?: boolean
    hasPrev?: boolean
  }

  constructor(data: T, message = '成功', meta?: SuccessResponse<T>['meta'], requestId?: string) {
    super(true, message, requestId)
    this.data = data
    this.meta = meta
  }
}

/**
 * エラーレスポンス
 * @trpg/api-contract の封筒型を implements しており、直列化形の乖離はコンパイルエラーになる（S5c で機械固定）
 */
export class ErrorResponse extends BaseApiResponse implements ErrorEnvelope {
  override readonly success: false

  @IsString()
  readonly error: string

  @IsOptional()
  @IsString()
  readonly errorCode?: string

  @IsOptional()
  @IsArray()
  readonly details?: Array<{
    field?: string
    message: string
    code?: string
  }>

  @IsOptional()
  readonly stack?: string

  constructor(
    error: string,
    message = DEFAULT_ERROR_RESPONSE_MESSAGE,
    errorCode?: string,
    details?: ErrorResponse['details'],
    stack?: string,
    requestId?: string,
    // P1-C: DTO は DI 不可のため、stack を含めるか（＝開発環境か）の判定は生成側（filter 等）が解決して渡す。
    // 既定 false（＝stack を含めない＝本番相当の安全側）。脱 process.env 直接参照。
    includeStack = false
  ) {
    super(false, message, requestId)
    this.error = error
    this.errorCode = errorCode
    this.details = details
    this.stack = includeStack ? stack : undefined
  }
}
