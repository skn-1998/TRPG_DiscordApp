import axios from 'axios'

// Node.js環境でSSL証明書検証を無効化
if (typeof process !== 'undefined' && process.versions?.node) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
  console.log('SSL certificate verification disabled for Node.js environment')
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
