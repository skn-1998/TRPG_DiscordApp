import 'server-only'

import type { SuccessEnvelope, UserProfileWire } from '@trpg/api-contract'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { apiClient } from './api-client.server'

export interface AuthState {
  user: UserProfileWire | null
  isLoggedIn: boolean
  hasValidJwt: boolean
}

const loggedOutAuthState: AuthState = {
  user: null,
  isLoggedIn: false,
  hasValidJwt: false
}

export const getAuthState = cache(async (): Promise<AuthState> => {
  const jwt = (await cookies()).get('jwt')?.value
  if (!jwt) {
    return loggedOutAuthState
  }

  try {
    const response = await apiClient.get<SuccessEnvelope<UserProfileWire>>('/users')

    return {
      user: response.data.data,
      isLoggedIn: true,
      hasValidJwt: true
    }
  } catch {
    // 共通 layout と公開ページは、認証検証に失敗しても未ログイン表示で描画を継続する。
    return loggedOutAuthState
  }
})
