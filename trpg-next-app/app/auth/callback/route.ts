import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isProduction } from '../../config/env.server'
import { buildJwtCookieOptions, loginOrRegisterUser } from '../../features/auth/api/auth.service.server'

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
    cookieStore.set('jwt', loginData.token, buildJwtCookieOptions(isProduction()))
    return NextResponse.redirect(new URL('/user', request.url))
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
