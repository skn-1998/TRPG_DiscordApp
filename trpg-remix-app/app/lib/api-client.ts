import axios from 'axios'
import https from 'https'

// 共通のaxiosインスタンスを作成
const createAxiosInstance = (baseURL: string) => {
  return axios.create({
    baseURL,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

const corsServerDomain = process.env.SERVER_DOMAIN || 'http://localhost:3000'
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
