import { AxiosResponse } from 'axios';
import { Observable } from 'rxjs';

export interface HttpServiceInterface {
  get<T>(url: string, config?: any): Observable<AxiosResponse<T>>;
  post<T>(url: string, data?: any, config?: any): Observable<AxiosResponse<T>>;
}
