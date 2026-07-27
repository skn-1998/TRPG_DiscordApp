import { useState, useEffect } from 'react'
import { useRouteLoaderData } from '@remix-run/react'
import type { UserProfileWire } from '@trpg/api-contract'

export type User = UserProfileWire

export interface AuthState {
  isLoggedIn: boolean
  isLoading: boolean
  hasValidJwt: boolean
  user: User | null
}

interface RootLoaderData {
  user: User | null
  isLoggedIn: boolean
  hasValidJwt: boolean
}

export function useAuth(): AuthState {
  const rootLoaderData = useRouteLoaderData('root') as RootLoaderData | undefined
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    isLoading: true,
    hasValidJwt: false,
    user: null
  })

  useEffect(() => {
    // ルートローダーからの認証状態を確認
    if (typeof window !== 'undefined') {
      try {
        if (rootLoaderData) {
          console.log('Root loader data:', rootLoaderData)

          const { isLoggedIn, hasValidJwt, user } = rootLoaderData

          console.log('Is logged in:', isLoggedIn)
          console.log('Has valid JWT:', hasValidJwt)
          console.log('User data:', user)

          setAuthState({
            isLoggedIn: isLoggedIn || false,
            hasValidJwt: hasValidJwt || false,
            user: user || null,
            isLoading: false
          })
        } else {
          // データがない場合は未認証扱い
          setAuthState({
            isLoggedIn: false,
            hasValidJwt: false,
            user: null,
            isLoading: false
          })
        }
      } catch (error) {
        console.error('Auth check error:', error)
        setAuthState({
          isLoggedIn: false,
          hasValidJwt: false,
          user: null,
          isLoading: false
        })
      }
    }
  }, [rootLoaderData])

  return authState
}
