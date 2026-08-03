import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import { getJwtFromRequest } from '../features/auth/api/auth.service'
import { apiClient, setServerRequestContext, clearServerRequestContext } from '../lib/api-client'

/**
 * ログインが必須のページで使用するガード関数
 * JWTが存在しない場合は/loginにリダイレクト
 * JWTが無効な場合も/loginにリダイレクト
 */
export async function requireLogin({ request }: LoaderFunctionArgs): Promise<void> {
  const jwt = getJwtFromRequest(request)

  if (!jwt) {
    console.log('JWT not found, redirecting to login')
    throw redirect('/login')
  }

  // JWTが存在する場合、有効性を再確認
  try {
    // サーバーリクエストコンテキストを設定
    setServerRequestContext(request, jwt)

    const response = await apiClient.get('/users')
    if (!response.data) {
      console.log('Invalid JWT, redirecting to login')
      throw redirect('/login')
    }
    console.log('JWT validation successful')
  } catch (error) {
    console.error('認証確認エラー:', error)
    throw redirect('/login')
  } finally {
    // コンテキストをクリア
    clearServerRequestContext()
  }
}
