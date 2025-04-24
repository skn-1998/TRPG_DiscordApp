import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { Observable, catchError, throwError } from 'rxjs'
import { AxiosResponse, AxiosRequestConfig, AxiosError } from 'axios'
import { HttpServiceInterface } from './interfaces/http.interface'
import { getErrorMessage } from '../utils/error-helpers'

/**
 * AxiosエラーかどうかをチェックするType Guard
 * @param error 未知のエラー
 * @returns エラーがAxiosエラーの場合true
 */
export function isAxiosError<T = unknown>(error: unknown): error is AxiosError<T> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as Record<string, unknown>).isAxiosError === true
  )
}

/**
 * HTTP通信のラッパーサービス
 * エラーハンドリングとロギングを追加
 */
@Injectable()
export class CustomHttpService implements HttpServiceInterface {
  private readonly logger = new Logger(CustomHttpService.name)

  constructor(private readonly httpService: HttpService) {}

  /**
   * GETリクエストを送信
   * @param url リクエスト先URL
   * @param config Axiosリクエスト設定
   * @returns レスポンスのObservable
   */
  get<T>(url: string, config?: AxiosRequestConfig): Observable<AxiosResponse<T>> {
    return this.httpService.get<T>(url, config).pipe(
      catchError((error: unknown) => {
        if (isAxiosError(error)) {
          this.logger.error(
            `HTTP GETリクエストエラー: ${url}, ステータス: ${error.response?.status}, メッセージ: ${error.message}`
          )
          return throwError(() => error)
        }

        this.logger.error(`HTTP GETリクエスト未定義エラー: ${url}, ${getErrorMessage(error)}`)
        return throwError(() => new Error(getErrorMessage(error)))
      })
    )
  }

  /**
   * POSTリクエストを送信
   * @param url リクエスト先URL
   * @param data リクエストボディ
   * @param config Axiosリクエスト設定
   * @returns レスポンスのObservable
   */
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Observable<AxiosResponse<T>> {
    return this.httpService.post<T>(url, data, config).pipe(
      catchError((error: unknown) => {
        if (isAxiosError(error)) {
          this.logger.error(
            `HTTP POSTリクエストエラー: ${url}, ステータス: ${error.response?.status}, メッセージ: ${error.message}`
          )
          return throwError(() => error)
        }

        this.logger.error(`HTTP POSTリクエスト未定義エラー: ${url}, ${getErrorMessage(error)}`)
        return throwError(() => new Error(getErrorMessage(error)))
      })
    )
  }
}
