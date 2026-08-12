import 'server-only'

import type { SuccessEnvelope, UserProfileWire } from '@trpg/api-contract'
import { cache } from 'react'
import { apiClient } from './api-client.server'
import { getResponseStatus } from './api-response.util'
import { readJwt } from './auth-guard.server'

export interface AuthState {
  user: UserProfileWire | null
  degradedByInfraFailure?: true
}

// 認証状態は user の有無を単一の正本とする。
const loggedOutAuthState: AuthState = {
  user: null
}

const infraDegradedAuthState: AuthState = {
  user: null,
  degradedByInfraFailure: true
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
      user: response.data.data
    }
  } catch (error) {
    const status = getResponseStatus(error)
    if (status === 401 || status === 403) {
      return loggedOutAuthState
    }

    // 公開面の soft degrade を保ちつつ、保護領域だけが infrastructure failure を識別できるようにする。
    return infraDegradedAuthState
  }
})
