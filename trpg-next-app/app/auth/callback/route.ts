import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isProduction } from '../../config/env.server'
import { buildJwtCookieOptions, loginOrRegisterUser } from '../../features/auth/api/auth.service.server'
import { JWT_COOKIE_NAME } from '../../lib/auth-guard.server'

export async function GET(request: Request): Promise<NextResponse> {
  const code = new URL(request.url).searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const loginData = await loginOrRegisterUser(code)
    if (!loginData.token) {
      throw new Error('jwtToken is not Exist')
    }

    const cookieStore = await cookies()
    cookieStore.set(JWT_COOKIE_NAME, loginData.token, buildJwtCookieOptions(isProduction()))
    return NextResponse.redirect(new URL('/user', request.url))
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
