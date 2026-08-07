import 'server-only'

import type { LoginDataWire, SuccessEnvelope } from '@trpg/api-contract'
import { getDiscordApplicationId, getHostDomain } from '../../../config/env.server'
import { apiClient } from '../../../lib/api-client.server'
import { extractApiErrorMessages, getResponseStatus } from '../../../lib/api-response.util'

interface JwtCookieOptions {
  httpOnly: true
  secure: boolean
  sameSite: 'none' | 'lax'
  path: '/'
  maxAge: number
}

interface OauthStateCookieOptions {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge: number
}

export const OAUTH_STATE_COOKIE_NAME = 'oauth_state'

export function generateDiscordAuthUrl(state: string): string {
  const redirectUri = `${getHostDomain()}/login`
  const params = new URLSearchParams({
    client_id: getDiscordApplicationId(),
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify email guilds',
    state
  })

  return `https://discord.com/oauth2/authorize?${params.toString()}`
}

export async function loginOrRegisterUser(code: string): Promise<LoginDataWire> {
  try {
    const response = await apiClient.post<SuccessEnvelope<LoginDataWire>, { code: string }>('/auth/login', { code })
    return response.data.data
  } catch (error: unknown) {
    const messages = extractApiErrorMessages(error).join(' / ')
    const status = getResponseStatus(error)
    if (status !== undefined) {
      console.error(`Login request failed (HTTP ${status}): ${messages}`)
    } else {
      console.error(`Login request failed: ${messages}`)
    }
    throw new Error(messages, { cause: error })
  }
}

export function buildJwtCookieOptions(isProductionEnvironment: boolean): JwtCookieOptions {
  return {
    httpOnly: true,
    secure: isProductionEnvironment,
    sameSite: isProductionEnvironment ? 'none' : 'lax',
    path: '/',
    maxAge: 604800 // 7 日
  }
}

export function buildOauthStateCookieOptions(isProductionEnvironment: boolean): OauthStateCookieOptions {
  return {
    httpOnly: true,
    secure: isProductionEnvironment,
    sameSite: 'lax',
    path: '/',
    maxAge: 600
  }
}
