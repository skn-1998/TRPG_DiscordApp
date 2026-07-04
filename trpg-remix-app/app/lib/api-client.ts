import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { ApiClientResponse, DomainDataMap, KnownDomains } from '../types/api'

type RequestConfig = AxiosRequestConfig

const baseClient = axios.create({
  baseURL: '/backend',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

baseClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(error)
)

class ExtendedApiClient {
  async getDomain<Domain extends KnownDomains>(
    url: string,
    _domain: Domain,
    config?: RequestConfig
  ): Promise<ApiClientResponse<DomainDataMap[Domain], Domain>> {
    return baseClient.get(url, config)
  }

  async postDomain<Domain extends KnownDomains>(
    url: string,
    _domain: Domain,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiClientResponse<DomainDataMap[Domain], Domain>> {
    return baseClient.post(url, data, config)
  }

  async putDomain<Domain extends KnownDomains>(
    url: string,
    _domain: Domain,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiClientResponse<DomainDataMap[Domain], Domain>> {
    return baseClient.put(url, data, config)
  }

  async deleteDomain<Domain extends KnownDomains>(
    url: string,
    _domain: Domain,
    config?: RequestConfig
  ): Promise<ApiClientResponse<DomainDataMap[Domain], Domain>> {
    return baseClient.delete(url, config)
  }

  async get<T = unknown>(url: string, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return baseClient.get<T>(url, config)
  }

  async post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return baseClient.post<T>(url, data, config)
  }

  async put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return baseClient.put<T>(url, data, config)
  }

  async delete<T = unknown>(url: string, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return baseClient.delete<T>(url, config)
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return baseClient.patch<T>(url, data, config)
  }

  get interceptors() {
    return baseClient.interceptors
  }
}

export const apiClient = new ExtendedApiClient()
