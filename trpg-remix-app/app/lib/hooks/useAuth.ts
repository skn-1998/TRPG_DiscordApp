import { useState, useEffect } from 'react'
import { User as TRPGUser } from '~/types'

export function useAuth() {
  const [user, setUser] = useState<TRPGUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true)
        // Note: validateJwtはLoaderFunctionArgsを必要とするため、
        // クライアントサイドでは別のアプローチが必要
        // ここではプレースホルダーとして記載
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  return { user, isLoading, error, setUser }
}
