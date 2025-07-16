import { Response } from 'express'

export class ApiResponseUtil {
  static success<T>(res: Response, data: T, status = 200): void {
    res.status(status).json({ success: true, data })
  }

  static error(res: Response, error: unknown, status = 500, message?: string): void {
    res.status(status).json({
      success: false,
      message: message || 'エラーが発生しました',
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
