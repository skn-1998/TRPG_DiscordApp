import { useState, useEffect } from 'react'
import { useRouteLoaderData } from '@remix-run/react'

export interface AuthState {
  isLoggedIn: boolean
  isLoading: boolean
}

export function useAuth(): AuthState {
  const rootLoaderData = useRouteLoaderData('root')
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    isLoading: true
  })

  useEffect(() => {
    // ルートローダーからの認証状態を確認
    if (typeof window !== 'undefined') {
      try {
        // rootLoaderDataに認証情報があるかチェック
        const hasAuth = !!(rootLoaderData && typeof rootLoaderData === 'object' && 'user' in rootLoaderData)

        console.log('Root loader data:', rootLoaderData)
        console.log('Has auth:', hasAuth)

        setAuthState({
          isLoggedIn: hasAuth,
          isLoading: false
        })
      } catch (error) {
        console.error('Auth check error:', error)
        setAuthState({
          isLoggedIn: false,
          isLoading: false
        })
      }
    }
  }, [rootLoaderData])

  return authState
}
