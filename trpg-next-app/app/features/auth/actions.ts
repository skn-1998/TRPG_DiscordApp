'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiClient } from '../../lib/api-client.server'
import { JWT_COOKIE_NAME } from '../../lib/auth-guard.server'

export async function logout(): Promise<never> {
  try {
    await apiClient.post('/auth/logout')
  } catch {
    // バックエンドの失敗より、ブラウザに無効な認証状態を残さない cookie 削除を優先する。
  }

  ;(await cookies()).delete(JWT_COOKIE_NAME)
  redirect('/login')
}
