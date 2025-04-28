import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { Observable } from 'rxjs'

/**
 * HTTPサービスのインターフェース
 * テストでのモック化を容易にするためのインターフェース
 */
export interface HttpServiceInterface {
  /**
   * GETリクエストを送信する
   * @param url リクエスト先URL
   * @param config Axiosの設定オプション
   * @returns レスポンスのObservable
   */
  get<T>(url: string, config?: AxiosRequestConfig): Observable<AxiosResponse<T>>

  /**
   * POSTリクエストを送信する
   * @param url リクエスト先URL
   * @param data 送信するデータ
   * @param config Axiosの設定オプション
   * @returns レスポンスのObservable
   */
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Observable<AxiosResponse<T>>
}
