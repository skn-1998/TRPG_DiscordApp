import axios from 'axios'

// Node.js環境でのみhttpsをインポート
let httpsAgent: any = undefined
if (typeof process !== 'undefined' && process.versions?.node) {
  try {
    const https = require('https')
    httpsAgent = new https.Agent({ rejectUnauthorized: false })
  } catch (error) {
    console.log('Running in browser environment, skipping https agent')
  }
}

// 共通のaxiosインスタンスを作成
const createAxiosInstance = (baseURL: string) => {
  const config: any = {
    baseURL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  }

  // Node.js環境でのみhttpsAgentを設定
  if (httpsAgent) {
    config.httpsAgent = httpsAgent
  }

  return axios.create(config)
}

const corsServerDomain =
  typeof process !== 'undefined' && process.env?.SERVER_DOMAIN ? process.env.SERVER_DOMAIN : 'http://localhost:3000'
console.log('corsServerDomain: ' + corsServerDomain)

export const apiClient = createAxiosInstance(corsServerDomain)

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
