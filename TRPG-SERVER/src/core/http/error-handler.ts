import { Logger, HttpException, HttpStatus } from '@nestjs/common'

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
   * サービス層エラーをハンドリング
   * このメソッドは必ず throw する。HttpException はそのまま、それ以外は 500 HttpException へ変換して再スローし、名前に反して復帰しない。
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
}
