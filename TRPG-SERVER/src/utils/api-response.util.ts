import { Response } from 'express'
import {
  SuccessResponse,
  ErrorResponse,
  ValidationErrorResponse,
  AuthenticationErrorResponse,
  AuthorizationErrorResponse,
  NotFoundErrorResponse,
  ConflictErrorResponse,
  InternalServerErrorResponse
} from '../core/dto/api-response.dto'
import { v4 as uuidv4 } from 'uuid'

/**
 * 強化されたAPIレスポンスユーティリティ
 * 標準化されたレスポンス形式を提供
 */
export class ApiResponseUtil {
  /**
   * 成功レスポンス
   */
  static success<T>(
    res: Response,
    data: T,
    _domain: string,
    status = 200,
    message = '成功',
    meta?: SuccessResponse<T>['meta']
  ): void {
    const requestId = uuidv4()
    const response = new SuccessResponse(data, message, meta, requestId)
    res.status(status).json(response)
  }

  /**
   * エラーレスポンス（汎用）
   */
  static error(res: Response, error: unknown, status = 500, message?: string, errorCode?: string): void {
    const requestId = uuidv4()
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined

    const response = new ErrorResponse(
      errorMessage,
      message || 'エラーが発生しました',
      errorCode,
      undefined,
      stack,
      requestId
    )

    res.status(status).json(response)
  }

  /**
   * バリデーションエラーレスポンス
   */
  static validationError(
    res: Response,
    validationErrors: Array<{ field: string; message: string; code?: string }>
  ): void {
    const requestId = uuidv4()
    const response = new ValidationErrorResponse(validationErrors, requestId)
    res.status(400).json(response)
  }

  /**
   * 認証エラーレスポンス
   */
  static authenticationError(res: Response, message?: string): void {
    const requestId = uuidv4()
    const response = new AuthenticationErrorResponse(message, requestId)
    res.status(401).json(response)
  }

  /**
   * 認可エラーレスポンス
   */
  static authorizationError(res: Response, message?: string): void {
    const requestId = uuidv4()
    const response = new AuthorizationErrorResponse(message, requestId)
    res.status(403).json(response)
  }

  /**
   * リソース未発見エラーレスポンス
   */
  static notFoundError(res: Response, resource?: string): void {
    const requestId = uuidv4()
    const response = new NotFoundErrorResponse(resource, requestId)
    res.status(404).json(response)
  }

  /**
   * 競合エラーレスポンス
   */
  static conflictError(res: Response, message?: string): void {
    const requestId = uuidv4()
    const response = new ConflictErrorResponse(message, requestId)
    res.status(409).json(response)
  }

  /**
   * サーバーエラーレスポンス
   */
  static internalServerError(res: Response, error?: unknown): void {
    const requestId = uuidv4()
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined

    const response = new InternalServerErrorResponse(errorMessage, stack, requestId)
    res.status(500).json(response)
  }

  /**
   * レガシー互換のためのsuccess（E2Eテスト対応）
   */
  static legacySuccess<T>(res: Response, data: T, _domain: string, status = 200): void {
    // E2Eテスト互換のため、ドメインラップは行わず素データを返す
    res.status(status).json(data)
  }

  /**
   * レガシー互換のためのerror（E2Eテスト対応）
   */
  static legacyError(res: Response, error: unknown, status = 500, message?: string): void {
    res.status(status).json({
      success: false,
      message: message || 'エラーが発生しました',
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
