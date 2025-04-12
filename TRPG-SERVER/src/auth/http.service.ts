import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AxiosResponse, AxiosRequestConfig } from 'axios';
import { HttpServiceInterface } from './interfaces/http.interface';

@Injectable()
export class CustomHttpService implements HttpServiceInterface {
  constructor(private readonly httpService: HttpService) {}

  get<T>(url: string, config?: AxiosRequestConfig): Observable<AxiosResponse<T>> {
    return this.httpService.get<T>(url, config);
  }

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Observable<AxiosResponse<T>> {
    return this.httpService.post<T>(url, data, config);
  }
}
