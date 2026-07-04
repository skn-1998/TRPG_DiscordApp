'use client'

import { createContext, ReactNode } from 'react'
import type { User } from '~/types'

export interface AuthState {
  isLoggedIn: boolean
  isLoading: boolean
  hasValidJwt: boolean
  user: User | null
}

export const AuthContext = createContext<AuthState | null>(null)

interface AuthProviderProps {
  children: ReactNode
  initialState: Omit<AuthState, 'isLoading'>
}

export function AuthProvider({ children, initialState }: AuthProviderProps) {
  return <AuthContext.Provider value={{ ...initialState, isLoading: false }}>{children}</AuthContext.Provider>
}
