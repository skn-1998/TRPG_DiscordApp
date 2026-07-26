import { IsBoolean, IsOptional, IsString, IsNumber, IsArray } from 'class-validator'
import type { SuccessEnvelope, ErrorEnvelope } from '@trpg/api-contract'

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
    message = 'エラーが発生しました',
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

/**
 * バリデーションエラーレスポンス
 */
export class ValidationErrorResponse extends ErrorResponse {
  constructor(validationErrors: Array<{ field: string; message: string; code?: string }>, requestId?: string) {
    super('バリデーションエラー', '入力値に問題があります', 'VALIDATION_ERROR', validationErrors, undefined, requestId)
  }
}

/**
 * 認証エラーレスポンス
 */
export class AuthenticationErrorResponse extends ErrorResponse {
  constructor(message = '認証に失敗しました', requestId?: string) {
    super(message, '認証エラー', 'AUTHENTICATION_ERROR', undefined, undefined, requestId)
  }
}

/**
 * 認可エラーレスポンス
 */
export class AuthorizationErrorResponse extends ErrorResponse {
  constructor(message = 'アクセス権限がありません', requestId?: string) {
    super(message, '認可エラー', 'AUTHORIZATION_ERROR', undefined, undefined, requestId)
  }
}

/**
 * リソース未発見エラーレスポンス
 */
export class NotFoundErrorResponse extends ErrorResponse {
  constructor(resource = 'リソース', requestId?: string) {
    super(`${resource}が見つかりません`, '未発見エラー', 'NOT_FOUND_ERROR', undefined, undefined, requestId)
  }
}

/**
 * 競合エラーレスポンス
 */
export class ConflictErrorResponse extends ErrorResponse {
  constructor(message = 'リソースが競合しています', requestId?: string) {
    super(message, '競合エラー', 'CONFLICT_ERROR', undefined, undefined, requestId)
  }
}

/**
 * サーバーエラーレスポンス
 */
export class InternalServerErrorResponse extends ErrorResponse {
  constructor(message = '内部サーバーエラーが発生しました', stack?: string, requestId?: string, includeStack = false) {
    super(message, 'サーバーエラー', 'INTERNAL_SERVER_ERROR', undefined, stack, requestId, includeStack)
  }
}
