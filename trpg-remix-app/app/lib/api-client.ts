import axios from 'axios'
import { configService } from '../config'

// Node.js環境でSSL証明書検証を無効化
if (typeof process !== 'undefined' && process.versions?.node) {
  // 開発環境でのみSSL証明書検証を無効化
  if (!configService.isProduction()) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
    console.log('SSL certificate verification disabled for development environment')
  }
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

  // Node.js環境でのみhttpAgent/httpsAgentを設定（IPv4を強制、SSL証明書検証を無効化）
  try {
    // Node.js環境かつrequireが利用可能な場合のみ
    if (typeof process !== 'undefined' && process.versions?.node && typeof require !== 'undefined') {
      const https = eval('require')('https')
      const http = eval('require')('http')

      // IPv4を強制使用してIPv6接続エラーを回避
      const agentOptions = {
        rejectUnauthorized: false,
        family: 4 // IPv4を強制使用
      }

      config.httpsAgent = new https.Agent(agentOptions)
      config.httpAgent = new http.Agent({ family: 4 })
      console.log('Using HTTP/HTTPS agents with IPv4 forced (family: 4)')
    }
  } catch (error) {
    // ブラウザ環境やVite環境では無視
    console.log('Skipping HTTP/HTTPS agent configuration (browser/Vite environment)')
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
        console.log('✅ Using explicit JWT from config')
      }
      // 2. クライアントサイドでクッキーから自動取得
      else {
        jwtToken = getCookieValue('jwt')
        console.log('🔍 Attempting to get JWT from cookies')
      }

      // デバッグ情報を追加
      console.log('🔍 JWT Debug Info:', {
        hasDocument: typeof document !== 'undefined',
        allCookies: typeof document !== 'undefined' ? document.cookie : 'N/A (SSR)',
        explicitJwt: !!configWithJwt.jwt,
        jwtToken: jwtToken,
        currentHeaders: config.headers
      })

      if (jwtToken && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${jwtToken}`
        console.log('✅ JWT Added to Authorization header')
      } else if (!jwtToken) {
        console.log('⚠️ No JWT token found')
      } else if (config.headers.Authorization) {
        console.log('ℹ️ Authorization header already exists:', config.headers.Authorization)
      }

      // configからjwtプロパティを削除（axiosに渡す必要がないため）
      delete configWithJwt.jwt

      console.log('🚀 API Request:', {
        method: config.method,
        url: config.url,
        baseURL: config.baseURL,
        headers: config.headers,
        data: config.data
      })
      return config
    },
    (error) => {
      console.error('🚨 Request Error:', error)
      return Promise.reject(error)
    }
  )

  // エラーハンドリング用のレスポンスインターセプター
  instance.interceptors.response.use(
    (response) => {
      console.log('✅ API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      })
      return response
    },
    (error) => {
      console.error('❌ API Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
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
  console.log('localhost -> 127.0.0.1 に変換してIPv6回避')
}

console.log('API Base URL:', apiBaseUrl)

// サーバーサイドでのリクエストコンテキスト管理
const serverRequestContext: { request?: Request; jwt?: string } = {}

// サーバーサイドでJWTを自動取得するための関数
const getServerSideJwt = (): string | null => {
  // Node.js環境でのみ実行
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      // コンテキストからJWTを取得
      if (serverRequestContext.jwt) {
        console.log('🔍 Using JWT from server context')
        return serverRequestContext.jwt
      }

      // リクエストからJWTを取得
      if (serverRequestContext.request) {
        console.log('🔍 Extracting JWT from server request')
        const cookieHeader = serverRequestContext.request.headers.get('Cookie') || ''
        const jwtCookie = cookieHeader.split(';').find((cookie) => cookie.trim().startsWith('jwt='))
        if (jwtCookie) {
          const jwt = jwtCookie.split('=')[1]
          console.log('✅ JWT extracted from server request')
          return jwt
        }
      }

      console.log('⚠️ No JWT found in server context')
      return null
    } catch (error) {
      console.log('Failed to get server-side JWT:', error)
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

  // GET リクエストの拡張
  async get<T = any>(url: string, config?: any): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    return this.baseClient.get<T>(url, finalConfig)
  }

  // POST リクエストの拡張
  async post<T = any>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    return this.baseClient.post<T>(url, data, finalConfig)
  }

  // PUT リクエストの拡張
  async put<T = any>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    return this.baseClient.put<T>(url, data, finalConfig)
  }

  // DELETE リクエストの拡張
  async delete<T = any>(url: string, config?: any): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    return this.baseClient.delete<T>(url, finalConfig)
  }

  // PATCH リクエストの拡張
  async patch<T = any>(
    url: string,
    data?: any,
    config?: any
  ): Promise<{ data: T; status: number; statusText: string }> {
    const finalConfig = this.prepareConfig(config)
    return this.baseClient.patch<T>(url, data, finalConfig)
  }

  // 設定の準備（サーバーサイドでJWT自動付与）
  private prepareConfig(config?: any): any {
    // すでにJWTが設定されている場合はそのまま返す
    if (config?.jwt || config?.headers?.Authorization) {
      return config
    }

    // サーバーサイドでJWTを自動取得
    const serverSideJwt = getServerSideJwt()
    if (serverSideJwt) {
      return {
        ...config,
        jwt: serverSideJwt
      }
    }

    // JWTが取得できない場合はそのまま返す
    return config
  }

  // インターセプターの設定
  get interceptors() {
    return this.baseClient.interceptors
  }
}

const baseApiClient = createAxiosInstance(apiBaseUrl)
export const apiClient = new ExtendedApiClient(baseApiClient)

// サーバーサイドでリクエストコンテキストを設定する関数
export const setServerRequestContext = (request: Request, jwt?: string) => {
  if (typeof process !== 'undefined' && process.versions?.node) {
    serverRequestContext.request = request
    if (jwt) {
      serverRequestContext.jwt = jwt
    }
    console.log('🔧 Server request context set')
  }
}

// サーバーサイドでリクエストコンテキストをクリアする関数
export const clearServerRequestContext = () => {
  if (typeof process !== 'undefined' && process.versions?.node) {
    serverRequestContext.request = undefined
    serverRequestContext.jwt = undefined
    console.log('🧹 Server request context cleared')
  }
}

// サーバーサイドで明示的にJWTを指定する場合のヘルパー
export const withJwt = (jwt: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { jwt } as any
}
