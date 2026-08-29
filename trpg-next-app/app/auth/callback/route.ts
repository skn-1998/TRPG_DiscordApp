import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getHostDomain, isProduction } from '../../config/env.server'
import {
  buildJwtCookieOptions,
  loginOrRegisterUser,
  OAUTH_STATE_COOKIE_NAME
} from '../../features/auth/api/auth.service.server'
import { JWT_COOKIE_NAME } from '../../lib/auth-guard.server'

export async function GET(request: Request): Promise<NextResponse> {
  const searchParams = new URL(request.url).searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieStore = await cookies()
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value
  cookieStore.delete(OAUTH_STATE_COOKIE_NAME)

  if (!code || !state || !storedState || state !== storedState) {
    const rejectionReason = !code
      ? 'missing code'
      : !state
        ? 'missing state'
        : !storedState
          ? 'missing state cookie'
          : 'state mismatch'
    console.warn(`OAuth callback rejected: ${rejectionReason}`)
    return NextResponse.redirect(new URL('/login', getHostDomain()))
  }

  try {
    const loginData = await loginOrRegisterUser(code)
    if (!loginData.token) {
      throw new Error('jwtToken is not Exist')
    }

    cookieStore.set(JWT_COOKIE_NAME, loginData.token, buildJwtCookieOptions(isProduction()))
    return NextResponse.redirect(new URL('/user', getHostDomain()))
  } catch {
    return NextResponse.redirect(new URL('/login', getHostDomain()))
  }
}
