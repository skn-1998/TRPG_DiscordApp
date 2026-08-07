import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isProduction } from '../../config/env.server'
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
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const loginData = await loginOrRegisterUser(code)
    if (!loginData.token) {
      throw new Error('jwtToken is not Exist')
    }

    cookieStore.set(JWT_COOKIE_NAME, loginData.token, buildJwtCookieOptions(isProduction()))
    return NextResponse.redirect(new URL('/user', request.url))
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
