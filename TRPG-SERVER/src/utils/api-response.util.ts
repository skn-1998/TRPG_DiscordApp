import { Response } from 'express'

export class ApiResponseUtil {
  static success<T>(res: Response, data: T, _domain: string, status = 200): void {
    // E2Eテスト互換のため、ドメインラップは行わず素データを返す
    res.status(status).json(data as any)
  }

  static error(res: Response, error: unknown, status = 500, message?: string): void {
    res.status(status).json({
      success: false,
      message: message || 'エラーが発生しました',
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
