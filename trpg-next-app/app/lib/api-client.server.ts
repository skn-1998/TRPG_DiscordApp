import 'server-only'

import axios, { AxiosHeaders } from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, RawAxiosHeaders } from 'axios'
import http from 'node:http'
import https from 'node:https'
import { cookies } from 'next/headers'
import { getServerDomain, isProduction } from '../config/env.server'

let axiosInstance: AxiosInstance | undefined

function getApiBaseUrl(): string {
  return getServerDomain().replace('://localhost', '://127.0.0.1')
}

function getAxiosInstance(): AxiosInstance {
  if (!axiosInstance) {
    axiosInstance = axios.create({
      baseURL: getApiBaseUrl(),
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      },
      httpAgent: new http.Agent({ family: 4 }),
      httpsAgent: new https.Agent({
        family: 4,
        rejectUnauthorized: isProduction()
      })
    })
  }

  return axiosInstance
}

async function withAuthorization<Data>(
  config: AxiosRequestConfig<Data> | undefined,
  explicitJwt: string | undefined
): Promise<AxiosRequestConfig<Data>> {
  const jwt = explicitJwt === undefined ? (await cookies()).get('jwt')?.value : explicitJwt

  if (!jwt) {
    return config ?? {}
  }

  const headers = AxiosHeaders.from(config?.headers as RawAxiosHeaders | AxiosHeaders | undefined)
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${jwt}`)
  }

  return { ...config, headers }
}

async function get<ResponseData = unknown>(
  url: string,
  config?: AxiosRequestConfig,
  jwt?: string
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().get<ResponseData>(url, await withAuthorization(config, jwt))
}

async function post<ResponseData = unknown, RequestData = unknown>(
  url: string,
  data?: RequestData,
  config?: AxiosRequestConfig<RequestData>,
  jwt?: string
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().post<ResponseData>(url, data, await withAuthorization(config, jwt))
}

async function put<ResponseData = unknown, RequestData = unknown>(
  url: string,
  data?: RequestData,
  config?: AxiosRequestConfig<RequestData>,
  jwt?: string
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().put<ResponseData>(url, data, await withAuthorization(config, jwt))
}

async function patch<ResponseData = unknown, RequestData = unknown>(
  url: string,
  data?: RequestData,
  config?: AxiosRequestConfig<RequestData>,
  jwt?: string
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().patch<ResponseData>(url, data, await withAuthorization(config, jwt))
}

async function remove<ResponseData = unknown>(
  url: string,
  config?: AxiosRequestConfig,
  jwt?: string
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().delete<ResponseData>(url, await withAuthorization(config, jwt))
}

export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: remove
}
