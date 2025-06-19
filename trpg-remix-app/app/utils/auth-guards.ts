import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import { getJwtFromRequest } from '../features/auth/api/auth.service'
import { apiClient, createAuthenticatedRequest } from '../lib/api-client'

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
    const response = await apiClient.get('/users', createAuthenticatedRequest(jwt))
    if (!response.data) {
      console.log('Invalid JWT, redirecting to login')
      throw redirect('/login')
    }
    console.log('JWT validation successful')
  } catch (error) {
    console.error('認証確認エラー:', error)
    throw redirect('/login')
  }
}

/**
 * よりソフトな認証チェック（エラーをthrowしない）
 * 認証状態を返すのみ
 */
export async function checkAuth({ request }: LoaderFunctionArgs): Promise<{
  isAuthenticated: boolean
  user: any | null
  error?: string
}> {
  const jwt = getJwtFromRequest(request)

  if (!jwt) {
    return { isAuthenticated: false, user: null, error: 'No JWT found' }
  }

  try {
    const response = await apiClient.get('/users', createAuthenticatedRequest(jwt))
    if (response.data) {
      return { isAuthenticated: true, user: response.data }
    } else {
      return { isAuthenticated: false, user: null, error: 'Invalid JWT' }
    }
  } catch (error) {
    console.error('Auth check error:', error)
    return { isAuthenticated: false, user: null, error: 'Auth check failed' }
  }
}

/**
 * 管理者権限が必要なページで使用するガード関数（将来拡張用）
 */
export async function requireAdmin(args: LoaderFunctionArgs): Promise<void> {
  await requireLogin(args)

  // TODO: 将来的に管理者権限チェックを追加
  // const user = await getUserFromJwt(request)
  // if (!user.isAdmin) {
  //   throw new Response('Forbidden', { status: 403 })
  // }
}

/**
 * リソースの所有者権限が必要な場合のガード関数（将来拡張用）
 */
export async function requireResourceOwnership(
  args: LoaderFunctionArgs,
  resourceId: string,
  resourceType: 'character' | 'scenario'
): Promise<void> {
  await requireLogin(args)

  // TODO: 将来的にリソース所有者チェックを追加
  // const user = await getUserFromJwt(request)
  // const resource = await getResource(resourceType, resourceId)
  // if (resource.ownerId !== user._id) {
  //   throw new Response('Forbidden', { status: 403 })
  // }
}
