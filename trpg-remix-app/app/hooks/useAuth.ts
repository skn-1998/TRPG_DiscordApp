'use client'

import { useContext } from 'react'
import { AuthContext, AuthState } from './AuthProvider'

export function useAuth(): AuthState {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
