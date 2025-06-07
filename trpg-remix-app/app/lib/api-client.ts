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

  // Node.js環境でのみhttpsAgentを設定（SSL証明書検証を無効化）
  try {
    // Node.js環境かつrequireが利用可能な場合のみ
    if (typeof process !== 'undefined' && process.versions?.node && typeof require !== 'undefined') {
      const https = eval('require')('https')
      config.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      })
      console.log('Using HTTPS agent with rejectUnauthorized: false')
    }
  } catch (error) {
    // ブラウザ環境やVite環境では無視
    console.log('Skipping HTTPS agent configuration (browser/Vite environment)')
  }

  return axios.create(config)
}

// 設定システムからAPIベースURLを取得
const apiBaseUrl = configService.get('server.domain') as string
console.log('API Base URL:', apiBaseUrl)

export const apiClient = createAxiosInstance(apiBaseUrl)

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
