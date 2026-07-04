import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { User } from '~/types'
import { serverApiRequest } from './server-api'

export interface ServerAuthState {
  user: User | null
  isLoggedIn: boolean
  hasValidJwt: boolean
}

export const getAuthState = cache(async (): Promise<ServerAuthState> => {
  const cookieStore = await cookies()

  if (!cookieStore.has('jwt')) {
    return {
      user: null,
      isLoggedIn: false,
      hasValidJwt: false
    }
  }

  try {
    const user = await serverApiRequest<User>('/users')

    return {
      user,
      isLoggedIn: true,
      hasValidJwt: true
    }
  } catch {
    return {
      user: null,
      isLoggedIn: false,
      hasValidJwt: false
    }
  }
})

export async function requireUser(): Promise<User> {
  const { user, hasValidJwt } = await getAuthState()

  if (!hasValidJwt || !user) {
    redirect('/login')
  }

  return user
}
