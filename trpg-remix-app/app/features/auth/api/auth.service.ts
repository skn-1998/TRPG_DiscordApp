import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import { apiClient, createAuthenticatedRequest } from '~/lib/api-client'
import { TRPGUser, LoginRequest, CookieHeader } from '~/lib/types'
import { CustomError } from '~/utils/customError'
import cookie from 'cookie'

// Discord OAuth認証URLを生成
export function generateDiscordAuthUrl(): string {
  // 一時的なテスト用のハードコード値
  const client_id = process.env.DISCORD_APPLICATIONID || 'TEST_CLIENT_ID'
  const redirect_url = `${process.env.HOST_DOMAIN || 'http://localhost:5173'}/login`
  console.log('🔧 Debug - client_id:', client_id)
  console.log('🔧 Debug - redirect_url:', redirect_url)

  const redirect_uri = encodeURIComponent(redirect_url)
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${client_id}&response_type=code&redirect_uri=${redirect_uri}&scope=identify`

  console.log('🔧 Debug - Generated Discord Auth URL:', discordAuthUrl)
  return discordAuthUrl
}

// ユーザーログイン/登録
export async function loginOrRegisterUser(code: string): Promise<TRPGUser> {
  try {
    console.log('before login')
    const response = await apiClient.post<TRPGUser>('/auth/login', { code } as LoginRequest)
    console.log('after login')
    return response.data
  } catch (err: unknown) {
    console.log('login catch error')

    // Axiosエラーの詳細情報を出力
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { status?: number; data?: unknown; headers?: unknown }; config?: unknown }
      console.error('HTTP Status:', axiosErr.response?.status)
      console.error('HTTP Data:', axiosErr.response?.data)
      console.error('HTTP Headers:', axiosErr.response?.headers)
      console.error('Request Config:', axiosErr.config)
    } else {
      console.error('Non-HTTP Error:', err)
    }

    throw new Error(CustomError(err))
  }
}

// JWT検証
export async function validateJWT({ request }: LoaderFunctionArgs): Promise<object | null> {
  const cookieHeader = request.headers.get('Cookie') || ''
  const jwtCookie = cookieHeader.split(';').find((cookie) => cookie.trim().startsWith('jwt='))

  if (!jwtCookie) {
    return redirect('/login')
  }

  const jwt = jwtCookie.split('=')[1]
  const verifyUrl = '/users'

  try {
    console.log('before verify')
    const response = await apiClient.get(verifyUrl, createAuthenticatedRequest(jwt))
    console.log('after verify')

    if (!response.data) {
      return redirect('/login')
    }

    console.log(response.data)
    return response.data
  } catch (err: unknown) {
    console.log('verify catch error')
    console.error(CustomError(err))
    return redirect('/login')
  }
}

// JWTをCookieに保存
export function saveJwtToken(jwt: string): CookieHeader {
  try {
    const cookieHeader = cookie.serialize('jwt', jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    })

    const cookieHeaders: CookieHeader = {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }

    return cookieHeaders
  } catch (e: unknown) {
    throw new Error(CustomError(e))
  }
}
