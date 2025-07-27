import { Response } from 'express'

export class ApiResponseUtil {
  static success<T>(res: Response, data: T, domain: string, status = 200): void {
    console.log(data)
    res.status(status).json({
      success: true,
      [domain]: data
    })
  }

  static error(res: Response, error: unknown, status = 500, message?: string): void {
    res.status(status).json({
      success: false,
      message: message || 'エラーが発生しました',
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
