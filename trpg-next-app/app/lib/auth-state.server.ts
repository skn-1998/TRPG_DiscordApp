import 'server-only'

import type { SuccessEnvelope, UserProfileWire } from '@trpg/api-contract'
import { cache } from 'react'
import { apiClient } from './api-client.server'
import { readJwt } from './auth-guard.server'

export interface AuthState {
  user: UserProfileWire | null
  isLoggedIn: boolean
  hasValidJwt: boolean
}

// error を持たない logged-out 返却形は旧 app の認証状態契約を pin する。
const loggedOutAuthState: AuthState = {
  user: null,
  isLoggedIn: false,
  hasValidJwt: false
}

export const getAuthState = cache(async (): Promise<AuthState> => {
  // requireJwt で redirect せず、JWT 不在時も未ログイン表示へ soft degrade する。
  const jwt = await readJwt()
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
