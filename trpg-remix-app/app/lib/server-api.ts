import 'server-only'

import { cookies } from 'next/headers'

const normalizeServerDomain = (value: string): string => value.replace(/\/+$/, '')

export function getServerDomain(): string {
  const configuredDomain = process.env.INTERNAL_SERVER_DOMAIN || process.env.SERVER_DOMAIN || 'http://127.0.0.1:3000'
  const serverDomain = configuredDomain === 'https://nginx.io/api' ? 'http://nestjs:3000' : configuredDomain

  return normalizeServerDomain(serverDomain)
}

export async function serverApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies()
  const jwt = cookieStore.get('jwt')?.value
  const headers = new Headers(init.headers)

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (jwt) {
    headers.set('Authorization', `Bearer ${jwt}`)
  }

  const response = await fetch(`${getServerDomain()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error(`Backend request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
