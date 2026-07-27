import { Logger, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'

/**
 * エラーレスポンスの型定義
 */
export interface ErrorResponse {
  success: false
  message: string
  error?: string
  timestamp: string
  path?: string
  statusCode?: number
}

/**
 * エラーコンテキストの型定義
 */
export interface ErrorContext {
  context?: string
  userId?: string
  discordUserId?: string
  characterId?: string
  channelId?: string
  guildId?: string
  messageId?: string
  messageCount?: number
  channelName?: string
  interactionId?: string
  customId?: string
  action?: string
  operation?: string
  diceResult?: any
  details?: any
  additionalData?: Record<string, unknown>
  // 新しいサービス用の追加プロパティ
  content?: string
  hasContent?: boolean
  hasEmbeds?: boolean
  hasComponents?: boolean
  reason?: string
  daysOld?: number
  limit?: number
  before?: string
  after?: string
  emoji?: string
  channelType?: any
  threadType?: any
  threadName?: string
  permissions?: any
  targetId?: string
  isRole?: boolean
  categoryName?: string
  settings?: any
}

/**
 * 統一されたエラーハンドリングクラス
 */
export class ErrorHandler {
  private static readonly logger = new Logger(ErrorHandler.name)

  /**
   * 汎用エラーハンドリング（既存コードとの互換性のため）
   * @param error エラーオブジェクト
   * @param context エラーコンテキスト
   */
  static async handleError(error: unknown, context: ErrorContext): Promise<void> {
    // ログ記録
    this.logError(error, context, 'GENERAL_ERROR')

    // エラーを再スローして上位層でハンドリング
    if (error instanceof HttpException) {
      throw error
    }

    // 一般的なエラーの場合、適切な HTTP エラーに変換
    throw new HttpException('処理中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
  }

  /**
   * HTTP API エラーをハンドリング
   * @param error エラーオブジェクト
   * @param context エラーコンテキスト
   * @param response Expressレスポンス
   * @param options.isProduction 本番判定（true で error 詳細を隠す）。
   *   本クラスは static utility で DI 不可のため、env 判定は呼び出し側（AppConfigService を注入できる境界）が
   *   解決して渡す（P1-C: 脱 process.env 直接参照）。未指定時は false（＝詳細露出）。
   */
  static handleHttpError(
    error: unknown,
    context: ErrorContext,
    response: Response,
    options?: { isProduction?: boolean }
  ): void {
    const errorMessage = this.extractErrorMessage(error)
    const isProduction = options?.isProduction ?? false

    // ログ記録
    this.logError(error, context, 'HTTP_API')

    // HTTPエラーの場合
    if (error instanceof HttpException) {
      const statusCode = error.getStatus()
      const errorResponse: ErrorResponse = {
        success: false,
        message: error.message,
        error: isProduction ? undefined : errorMessage,
        timestamp: new Date().toISOString(),
        statusCode
      }

      response.status(statusCode).json(errorResponse)
      return
    }

    // 一般的なエラーの場合
    const errorResponse: ErrorResponse = {
      success: false,
      message: 'リクエストの処理中にエラーが発生しました',
      error: isProduction ? undefined : errorMessage,
      timestamp: new Date().toISOString(),
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse)
  }

  /**
   * サービス層エラーをハンドリング
   * @param error エラーオブジェクト
   * @param context エラーコンテキスト
   * @param serviceName サービス名
   */
  static handleServiceError(error: unknown, context: ErrorContext, serviceName: string): void {
    this.logError(error, context, `SERVICE_${serviceName.toUpperCase()}`)

    // エラーを再スローして上位層でハンドリング
    if (error instanceof HttpException) {
      throw error
    }

    // 一般的なエラーの場合、適切な HTTP エラーに変換
    throw new HttpException('サービス処理中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
  }

  /**
   * エラーメッセージを抽出
   * @param error エラーオブジェクト
   * @returns エラーメッセージ
   */
  private static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }

    if (typeof error === 'string') {
      return error
    }

    return JSON.stringify(error)
  }

  /**
   * 構造化されたエラーログを記録
   * @param error エラーオブジェクト
   * @param context エラーコンテキスト
   * @param type エラータイプ
   */
  static logError(error: unknown, context: ErrorContext, type: string): void {
    const errorMessage = this.extractErrorMessage(error)
    const timestamp = new Date().toISOString()

    const logData = {
      timestamp,
      type,
      message: errorMessage,
      context: {
        ...context,
        // 機密情報を除外
        ...(context.additionalData && this.sanitizeAdditionalData(context.additionalData))
      },
      stack: error instanceof Error ? error.stack : undefined
    }

    // エラーレベルに応じてログレベルを調整
    if (this.isCriticalError(error)) {
      this.logger.error('CRITICAL_ERROR', logData)
    } else {
      this.logger.error('ERROR', logData)
    }
  }

  /**
   * 機密情報をサニタイズ
   * @param data 追加データ
   * @returns サニタイズされたデータ
   */
  private static sanitizeAdditionalData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...data }

    // 機密情報のキーを除外
    const sensitiveKeys = [
      'token',
      'password',
      'secret',
      'key',
      'authorization',
      'discordAccessToken',
      'discordRefreshToken',
      'jwt'
    ]

    sensitiveKeys.forEach((key) => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]'
      }
    })

    return sanitized
  }

  /**
   * クリティカルエラーかどうかを判定
   * @param error エラーオブジェクト
   * @returns クリティカルエラーの場合true
   */
  private static isCriticalError(error: unknown): boolean {
    if (error instanceof Error) {
      const criticalPatterns = [/database/i, /connection/i, /timeout/i, /auth/i, /permission/i]

      return criticalPatterns.some((pattern) => pattern.test(error.message))
    }

    return false
  }

  /**
   * エラー統計情報を取得（将来的な監視用）
   * @returns エラー統計
   */
  static getErrorStats(): Record<string, number> {
    // 実装は将来的に追加（Redis等を使用）
    return {}
  }
}

/**
 * バックグラウンドタスクエラーハンドラー
 */
export class BackgroundTaskErrorHandler {
  /**
   * バックグラウンドタスクエラーをハンドリング
   * @param error エラーオブジェクト
   * @param taskName タスク名
   * @param context エラーコンテキスト
   */
  static handleBackgroundError(error: unknown, taskName: string, context: ErrorContext = {}): void {
    ErrorHandler.logError(
      error,
      {
        ...context,
        action: taskName
      },
      'BACKGROUND_TASK'
    )

    // バックグラウンドタスクのエラーは処理を続行
    // 必要に応じて再試行やアラート機能を追加
  }
}
