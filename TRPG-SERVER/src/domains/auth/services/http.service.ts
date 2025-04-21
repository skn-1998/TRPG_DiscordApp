import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AxiosResponse, AxiosRequestConfig } from 'axios';
import { HttpServiceInterface } from '../interfaces/http.interface';

/**
 * HTTPサービスの実装
 * 外部APIとの通信を担当
 */
@Injectable()
export class HttpClientService implements HttpServiceInterface {
  constructor(private readonly httpService: HttpService) {}

  /**
   * GETリクエストを送信する
   * @param url リクエスト先URL
   * @param config Axiosの設定オプション
   * @returns レスポンスのObservable
   */
  get<T>(url: string, config?: AxiosRequestConfig): Observable<AxiosResponse<T>> {
    return this.httpService.get<T>(url, config);
  }

  /**
   * POSTリクエストを送信する
   * @param url リクエスト先URL
   * @param data 送信するデータ
   * @param config Axiosの設定オプション
   * @returns レスポンスのObservable
   */
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Observable<AxiosResponse<T>> {
    return this.httpService.post<T>(url, data, config);
  }
} 