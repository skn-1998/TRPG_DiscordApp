import { NextResponse } from 'next/server'
import { isProduction } from '../../config/env.server'
import {
  buildOauthStateCookieOptions,
  generateDiscordAuthUrl,
  OAUTH_STATE_COOKIE_NAME
} from '../../features/auth/api/auth.service.server'

export async function GET(): Promise<NextResponse> {
  const state = crypto.randomUUID()
  const response = NextResponse.redirect(generateDiscordAuthUrl(state))
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, buildOauthStateCookieOptions(isProduction()))
  return response
}
