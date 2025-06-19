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

  return axios.create(config)
}

// 設定システムからAPIベースURLを取得
let apiBaseUrl = configService.get('server.domain') as string

// localhostをIPv4アドレスに強制変換してIPv6回避
if (apiBaseUrl.includes('://localhost')) {
  apiBaseUrl = apiBaseUrl.replace('://localhost', '://127.0.0.1')
  console.log('localhost -> 127.0.0.1 に変換してIPv6回避')
}

console.log('API Base URL:', apiBaseUrl)

export const apiClient = createAxiosInstance(apiBaseUrl)

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

// JWT付きリクエスト用のヘルパー
export const createAuthenticatedRequest = (jwt: string) => {
  return {
    headers: {
      Authorization: `Bearer ${jwt}`
    }
  }
}

// デバッグ用のリクエストインターセプター
apiClient.interceptors.request.use(
  (config) => {
    // JWTクッキーを自動的に取得してAuthorizationヘッダーに追加
    const jwtToken = getCookieValue('jwt')
    if (jwtToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${jwtToken}`
    }

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
apiClient.interceptors.response.use(
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
