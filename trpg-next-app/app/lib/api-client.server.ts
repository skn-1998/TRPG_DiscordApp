import 'server-only'

// TRPG-SERVER の 2xx は controller 単位で SuccessEnvelope と bare entity に分かれる。
// unwrap の要否は呼び出し側が endpoint ごとに選ぶ（対応表は AI.md）。
import axios, { AxiosHeaders } from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, RawAxiosHeaders } from 'axios'
import http from 'node:http'
import https from 'node:https'
import { getServerDomain, isProduction } from '../config/env.server'
import { readJwt } from './auth-guard.server'

let axiosInstance: AxiosInstance | undefined

function getApiBaseUrl(): string {
  // localhost の IPv6 解決差を避け、TRPG-SERVER への接続を IPv4 に固定する。
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
      // Node.js の HTTP/HTTPS 接続も IPv4 に固定する。
      httpAgent: new http.Agent({ family: 4 }),
      httpsAgent: new https.Agent({
        family: 4,
        rejectUnauthorized: isProduction() // development では自己署名証明書を許容する。
      })
    })
  }

  return axiosInstance
}

async function withAuthorization<Data>(config: AxiosRequestConfig<Data> | undefined): Promise<AxiosRequestConfig<Data>> {
  const jwt = await readJwt()

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
  config?: AxiosRequestConfig
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().get<ResponseData>(url, await withAuthorization(config))
}

async function post<ResponseData = unknown, RequestData = unknown>(
  url: string,
  data?: RequestData,
  config?: AxiosRequestConfig<RequestData>
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().post<ResponseData>(url, data, await withAuthorization(config))
}

async function put<ResponseData = unknown, RequestData = unknown>(
  url: string,
  data?: RequestData,
  config?: AxiosRequestConfig<RequestData>
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().put<ResponseData>(url, data, await withAuthorization(config))
}

async function patch<ResponseData = unknown, RequestData = unknown>(
  url: string,
  data?: RequestData,
  config?: AxiosRequestConfig<RequestData>
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().patch<ResponseData>(url, data, await withAuthorization(config))
}

async function remove<ResponseData = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<ResponseData>> {
  return getAxiosInstance().delete<ResponseData>(url, await withAuthorization(config))
}

export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: remove
}
