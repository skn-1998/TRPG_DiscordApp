import type { ErrorEnvelope, LoginDataWire, SuccessEnvelope } from '@trpg/api-contract'
import axios from 'axios'
import { getDiscordApplicationId, getHostDomain } from '../../../config/env.server'
import { apiClient } from '../../../lib/api-client.server'

interface JwtCookieOptions {
  httpOnly: true
  secure: boolean
  sameSite: 'none' | 'lax'
  path: '/'
  maxAge: number
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { success?: unknown }).success === false &&
    typeof (value as { error?: unknown }).error === 'string'
  )
}

function getErrorEnvelopeMessages(envelope: ErrorEnvelope): string[] {
  const issueMessages = envelope.issues?.map((issue) => issue.message).filter(Boolean) ?? []
  if (issueMessages.length > 0) return [...new Set(issueMessages)]

  const causeMessage = envelope.cause?.message
  if (Array.isArray(causeMessage) && causeMessage.every((message) => typeof message === 'string')) {
    const causeMessages = causeMessage.filter(Boolean)
    if (causeMessages.length > 0) return causeMessages
  }

  const detailMessages = envelope.details?.map((detail) => detail.message).filter(Boolean) ?? []
  if (detailMessages.length > 0) return [...new Set(detailMessages)]

  return [envelope.error || envelope.message]
}

function getLoginErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const responseData: unknown = error.response?.data

    if (isErrorEnvelope(responseData)) {
      return `HTTP ${status}: ${getErrorEnvelopeMessages(responseData).join(' / ')}`
    }

    if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      return `HTTP ${status}: ${String(responseData.message)}`
    }

    return `HTTP ${status}: ${error.response?.statusText || 'Request failed'}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown Error'
}

export function generateDiscordAuthUrl(): string {
  const redirectUri = `${getHostDomain()}/login`
  const params = new URLSearchParams({
    client_id: getDiscordApplicationId(),
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify email guilds'
  })

  return `https://discord.com/oauth2/authorize?${params.toString()}`
}

export async function loginOrRegisterUser(code: string): Promise<LoginDataWire> {
  try {
    const response = await apiClient.post<SuccessEnvelope<LoginDataWire>, { code: string }>('/auth/login', { code })
    return response.data.data
  } catch (error: unknown) {
    const message = getLoginErrorMessage(error)
    console.error(`Login request failed: ${message}`)
    throw new Error(message, { cause: error })
  }
}

export function buildJwtCookieOptions(isProductionEnvironment: boolean): JwtCookieOptions {
  return {
    httpOnly: true,
    secure: isProductionEnvironment,
    sameSite: isProductionEnvironment ? 'none' : 'lax',
    path: '/',
    maxAge: 604800
  }
}
