import axios from 'axios'
import { configService } from '../config'
import { ApiClientResponse, KnownDomains, DomainDataMap } from '../types/api'

// 開発環境判定
const isDevelopment = !configService.isProduction()

// Node.js環境でのSSL証明書検証設定（開発環境のみ）
if (typeof process !== 'undefined' && process.versions?.node && isDevelopment) {
  // 開発環境でのみSSL証明書検証を無効化
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
  if (isDevelopment) {
    console.log('SSL certificate verification disabled for development environment')
  }
}

// 安全なHTTPモジュール読み込み関数
const loadHttpModules = () => {
  if (typeof process !== 'undefined' && process.versions?.node && typeof require !== 'undefined') {
    try {
      // eval()を使わずに安全にモジュールを読み込み
      return {
        https: require('https'),
        http: require('http')
      }
    } catch (error) {
      if (isDevelopment) {
        console.log('Failed to load HTTP modules:', error)
      }
      return null
    }
  }
  return null
}

// 共通のaxiosインスタンスを作成
const createAxiosInstance = (baseURL: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    baseURL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  }

  // Node.js環境でのみhttpAgent/httpsAgentを設定（IPv4を強制）
  try {
    const httpModules = loadHttpModules()

    if (httpModules) {
      const { https, http } = httpModules

      // 開発環境と本番環境で異なるAgent設定
      const agentOptions = {
        rejectUnauthorized: isDevelopment ? false : true, // 本番環境では証明書検証を有効化
        family: 4 // IPv4を強制使用
      }

      config.httpsAgent = new https.Agent(agentOptions)
      config.httpAgent = new http.Agent({ family: 4 })

      if (isDevelopment) {
        console.log('Using HTTP/HTTPS agents with IPv4 forced (family: 4)')
      }
    }
  } catch (error) {
    // ブラウザ環境やVite環境では無視
    if (isDevelopment) {
      console.log('Skipping HTTP/HTTPS agent configuration (browser/Vite environment)')
    }
  }

  const instance = axios.create(config)

  // Cookieから値を取得するユーティリティ関数
  const getCookieValue = (name: string): string | null => {
    // ブラウザ環境
    if (typeof document !== 'undefined') {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null
      }
    }

    // Node.js環境 - リクエストコンテキストからcookieを取得
    // この場合は通常、アプリケーション側でcookieを設定する必要があります
    return null
  }

  // リクエストインターセプターでjwtクッキーを自動追加
  instance.interceptors.request.use(
    (config) => {
      let jwtToken: string | null = null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configWithJwt = config as any

      // 1. 明示的にjwtが渡された場合（サーバーサイド用）
      if (configWithJwt.jwt) {
        jwtToken = configWithJwt.jwt
        if (isDevelopment) {
          console.log('✅ Using explicit JWT from config')
        }
      }
      // 2. クライアントサイドでクッキーから自動取得
      else {
        jwtToken = getCookieValue('jwt')
        if (isDevelopment) {
          console.log('🔍 Attempting to get JWT from cookies')
        }
      }

      // デバッグ情報を追加（開発環境のみ）
      if (isDevelopment) {
        console.log('🔍 JWT Debug Info:', {
          hasDocument: typeof document !== 'undefined',
          allCookies: typeof document !== 'undefined' ? document.cookie : 'N/A (SSR)',
          explicitJwt: !!configWithJwt.jwt,
          jwtToken: jwtToken ? 'Present' : 'Not found', // トークン値は表示しない
          currentHeaders: config.headers
        })
      }

      if (jwtToken && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${jwtToken}`
        if (isDevelopment) {
          console.log('✅ JWT Added to Authorization header')
        }
      } else if (!jwtToken) {
        if (isDevelopment) {
          console.log('⚠️ No JWT token found')
        }
      } else if (config.headers.Authorization) {
        if (isDevelopment) {
          console.log('ℹ️ Authorization header already exists')
        }
      }

      // configからjwtプロパティを削除（axiosに渡す必要がないため）
      delete configWithJwt.jwt

      if (isDevelopment) {
        console.log('🚀 API Request:', {
          method: config.method,
          url: config.url,
          baseURL: config.baseURL,
          headers: { ...config.headers, Authorization: config.headers.Authorization ? '[REDACTED]' : undefined },
          data: config.data
        })
      }
      return config
    },
    (error) => {
      if (isDevelopment) {
        console.error('🚨 Request Error:', error)
      }
      return Promise.reject(error)
    }
  )

  // エラーハンドリング用のレスポンスインターセプター
  instance.interceptors.response.use(
    (response) => {
      if (isDevelopment) {
        console.log('✅ API Response:', {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        })
      }
      return response
    },
    (error) => {
      // エラーは本番環境でも記録（ただし機密情報は除外）
      console.error('❌ API Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        ...(isDevelopment && { data: error.response?.data })
      })
      return Promise.reject(error)
    }
  )

  return instance
}

// 設定システムからAPIベースURLを取得
let apiBaseUrl = configService.get('server.domain') as string

// localhostをIPv4アドレスに強制変換してIPv6回避
if (apiBaseUrl.includes('://localhost')) {
  apiBaseUrl = apiBaseUrl.replace('://localhost', '://127.0.0.1')
  if (isDevelopment) {
    console.log('localhost -> 127.0.0.1 に変換してIPv6回避')
  }
}

if (isDevelopment) {
  console.log('API Base URL:', apiBaseUrl)
}

// サーバーサイドでのリクエストコンテキスト管理
const serverRequestContext: { request?: Request; jwt?: string } = {}

// サーバーサイドでJWTを自動取得するための関数
const getServerSideJwt = (): string | null => {
  // Node.js環境でのみ実行
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      // コンテキストからJWTを取得
      if (serverRequestContext.jwt) {
        if (isDevelopment) {
          console.log('🔍 Using JWT from server context')
        }
        return serverRequestContext.jwt
      }

      // リクエストからJWTを取得
      if (serverRequestContext.request) {
        if (isDevelopment) {
          console.log('🔍 Extracting JWT from server request')
        }
        const cookieHeader = serverRequestContext.request.headers.get('Cookie') || ''
        const jwtCookie = cookieHeader.split(';').find((cookie) => cookie.trim().startsWith('jwt='))
        if (jwtCookie) {
          const jwt = jwtCookie.split('=')[1]
          if (isDevelopment) {
            console.log('✅ JWT extracted from server request')
          }
          return jwt
        }
      }

      if (isDevelopment) {
        console.log('⚠️ No JWT found in server context')
      }
      return null
    } catch (error) {
      if (isDevelopment) {
        console.log('Failed to get server-side JWT:', error)
      }
      return null
    }
  }
  return null
}

// APIクライアントの拡張版
class ExtendedApiClient {
  private baseClient: ReturnType<typeof createAxiosInstance>

  constructor(baseClient: ReturnType<typeof createAxiosInstance>) {
    this.baseClient = baseClient
  }

  // 型安全なGETリクエスト（ドメイン指定版）
  async getDomain<Domain extends KnownDomains>(
    url: string,
    domain: Domain,
    config?: any
  ): Promise<ApiClientResponse<DomainDataMap[Domain], Domain>> {
    const finalConfig = this.prepareConfig(config)
    const response = await this.baseClient.get(url, finalConfig)
    return response
  }

  // 型安全なPOSTリクエスト（ドメイン指定版）
  async postDomain<Domain extends KnownDomains>(
    url: string,
    domain: Domain,
    data?: any,
    config?: any
  ): Promise<ApiClientResponse<DomainDataMap[Domain], Domain>> {
    const finalConfig = this.prepareConfig(config)
    const response = await this.baseClient.post(url, data, finalConfig)
    return response
  }

  // 型安全なPUTリクエスト（ドメイン指定版）
  async putDomain<Domain extends KnownDomains>(
    url: string,
    domain: Domain,
    data?: any,
    config?: any
  ): Promise<ApiClientResponse<DomainDataMap[Domain], Domain>> {
    const finalConfig = this.prepareConfig(config)
    const response = await this.baseClient.put(url, data, finalConfig)
    return response
  }

  // 型安全なDELETEリクエスト（ドメイン指定版）
  async deleteDomain<Domain extends KnownDomains>(
    url: string,
    domain: Domain,
    config?: any
  ): Promise<ApiClientResponse<DomainDataMap[Domain], Domain>> {
    const finalConfig = this.prepareConfig(config)
    const response = await this.baseClient.delete(url, finalConfig)
    return response
  }

  // 従来のメソッド（後方互換性のため）
  async get<T = any>(url: string, config?: any): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    const response = await this.baseClient.get<T>(url, finalConfig)
    return response
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    const response = await this.baseClient.post<T>(url, data, finalConfig)
    return response
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    const response = await this.baseClient.put<T>(url, data, finalConfig)
    return response
  }

  async delete<T = any>(url: string, config?: any): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    const response = await this.baseClient.delete<T>(url, finalConfig)
    return response
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: any
  ): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    const response = await this.baseClient.patch<T>(url, data, finalConfig)
    return response
  }

  // 設定の準備（サーバーサイドJWTの自動設定など）
  private prepareConfig(config?: any): any {
    const finalConfig = { ...config }

    // サーバーサイドでJWTが明示的に設定されていない場合、自動取得を試行
    if (!finalConfig.jwt && typeof process !== 'undefined' && process.versions?.node) {
      const serverJwt = getServerSideJwt()
      if (serverJwt) {
        finalConfig.jwt = serverJwt
      }
    }

    return finalConfig
  }

  // axiosインスタンスのインターセプターにアクセス
  get interceptors() {
    return this.baseClient.interceptors
  }
}

// サーバーサイドでリクエストコンテキストを設定
export const setServerRequestContext = (request: Request, jwt?: string) => {
  serverRequestContext.request = request
  if (jwt) {
    serverRequestContext.jwt = jwt
  }
  if (isDevelopment) {
    console.log('Server request context set')
  }
}

// サーバーサイドでリクエストコンテキストをクリア
export const clearServerRequestContext = () => {
  serverRequestContext.request = undefined
  serverRequestContext.jwt = undefined
  if (isDevelopment) {
    console.log('Server request context cleared')
  }
}

// JWTを手動で設定するためのヘルパー関数
export const withJwt = (jwt: string) => {
  return { jwt }
}

// APIクライアントのインスタンスを作成
export const apiClient = new ExtendedApiClient(createAxiosInstance(apiBaseUrl))
