/* eslint-disable no-console */
import type { SuccessEnvelope } from '@trpg/api-contract'
import { apiClient } from '../../../lib/api-client'
import { ApiResponseUtil } from '../../../lib/api-response.util'
import type { LoginData, LoginRequest, LoginResponse } from '../../../types'
import { CustomError } from '../../../utils/customError'
import { configService } from '../../../config'
import cookie from 'cookie'

// CookieHeader型定義
interface CookieHeader {
  'Content-Type': string
  'Set-Cookie': string
}

// Discord OAuth認証URLを生成
export function generateDiscordAuthUrl(): string {
  const applicationId = configService.get('discord.applicationId') as string
  const hostDomain = configService.get('server.hostDomain') as string
  const redirectUri = `${hostDomain}/login`

  // URLSearchParamsを使用してパラメータを適切にエンコード
  const params = new URLSearchParams({
    client_id: applicationId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify email guilds'
  })

  const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`

  console.log('🔗 Discord OAuth URL:', discordAuthUrl)
  console.log('📋 OAuth Scope:', 'identify email guilds')

  return discordAuthUrl
}

// ユーザーログイン/登録
export async function loginOrRegisterUser(code: string): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<SuccessEnvelope<LoginData>>('/auth/login', { code } as LoginRequest)
    const envelope = response.data

    // 失敗応答は HTTP 4xx/5xx + ErrorEnvelope で返り axios reject（catch 節）に入る。2xx は常に SuccessEnvelope（http-exception.filter が全経路で status を明示するため）
    const loginData = envelope.data

    console.log('🔐 ログイン成功:', {
      success: envelope.success,
      message: loginData.message,
      userName: loginData.userName,
      discordUserId: loginData.discordUserId
    })

    return loginData
  } catch (err: unknown) {
    // 統合エラーハンドリング
    const errorMessage = ApiResponseUtil.handleError(err)
    console.error('❌ ログインエラー:', errorMessage)

    // 詳細デバッグ情報も出力
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { status?: number; data?: unknown; headers?: unknown }; config?: unknown }
      console.error('HTTP Status:', axiosErr.response?.status)
      console.error('HTTP Data:', axiosErr.response?.data)
    }

    throw new Error(CustomError(err))
  }
}

export function getJwtFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie') || ''
  const jwtCookie = cookieHeader.split(';').find((cookie) => cookie.trim().startsWith('jwt='))
  if (!jwtCookie) return null
  const jwt = jwtCookie.split('=')[1]
  return jwt
}

// JWTをCookieに保存
export function saveJwtToken(jwt: string): CookieHeader {
  try {
    const isProduction = configService.isProduction()
    const jwtExpiresIn = 60 * 60 * 24 * 7 // 7日間

    // 環境に応じたドメイン設定
    const getDomainSetting = () => {
      if (isProduction) {
        // 本番環境：実際のドメインを設定
        // 例: return 'your-domain.com'
        return undefined // 現在は未指定（自動判定）
      } else {
        // 開発環境：localhostの場合のみドメインを設定
        if (typeof window !== 'undefined') {
          const hostname = window.location.hostname
          if (hostname === 'localhost') {
            return 'localhost'
          }
        }
        return undefined // IPアドレス経由等は未指定
      }
    }

    const domain = getDomainSetting()

    const cookieOptions: cookie.SerializeOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: jwtExpiresIn,
      ...(domain && { domain }) // domainが存在する場合のみ追加
    }

    console.log('🍪 クッキー設定:', {
      isProduction,
      domain,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite
    })

    const cookieHeader = cookie.serialize('jwt', jwt, cookieOptions)

    const cookieHeaders: CookieHeader = {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }

    return cookieHeaders
  } catch (e: unknown) {
    throw new Error(CustomError(e))
  }
}

// クッキーテスト用関数
export async function testCookies(): Promise<void> {
  try {
    console.log('🍪 クッキーテストリクエスト開始')

    // 認証が必要なエンドポイントでクッキーが送信されるかテスト
    const response = await apiClient.get('/users', {
      withCredentials: true
    })

    console.log('✅ クッキーテスト成功:', response.status)
  } catch (err: unknown) {
    console.error('❌ クッキーテスト失敗:', CustomError(err))
  }
}

export async function logoutUser(): Promise<void> {
  try {
    console.log('🚪 ログアウトリクエスト開始')

    // 明示的にwithCredentialsを指定してクッキーを確実に送信
    const response = await apiClient.post(
      '/auth/logout',
      {},
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('✅ ログアウトレスポンス:', response.data)
  } catch (err: unknown) {
    console.error('❌ ログアウトエラー:', CustomError(err))

    // エラーでも詳細を出力
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { status?: number; data?: unknown; headers?: unknown } }
      console.error('ログアウトエラー詳細:')
      console.error('- Status:', axiosErr.response?.status)
      console.error('- Data:', axiosErr.response?.data)
      console.error('- Headers:', axiosErr.response?.headers)
    }

    throw new Error(CustomError(err))
  }
}
