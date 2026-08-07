jest.mock('server-only', () => ({}))

jest.mock('../../config/env.server', () => ({
  getDiscordApplicationId: jest.fn(() => 'pinned-client-id'),
  getHostDomain: jest.fn(() => 'https://frontend.example.com'),
  isProduction: jest.fn(() => false)
}))

jest.mock('../../lib/api-client.server', () => ({
  apiClient: {
    post: jest.fn()
  }
}))

import { OAUTH_STATE_COOKIE_NAME } from '../../features/auth/api/auth.service.server'
import { GET } from './route'

describe('GET /auth/start', () => {
  it('state cookie を設定し、同じ state を含む Discord OAuth URL へ 307 redirect する', async () => {
    const response = await GET()
    const stateCookie = response.cookies.get(OAUTH_STATE_COOKIE_NAME)
    const location = response.headers.get('Location')

    expect(response.status).toBe(307)
    expect(stateCookie?.value).toBeTruthy()
    expect(location).not.toBeNull()

    const authUrl = new URL(location as string)
    expect(authUrl.origin).toBe('https://discord.com')
    expect(authUrl.pathname).toBe('/oauth2/authorize')
    expect(authUrl.searchParams.get('state')).toBe(stateCookie?.value)

    expect(response.headers.get('Set-Cookie')).toContain(`${OAUTH_STATE_COOKIE_NAME}=${stateCookie?.value}`)
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly')
    expect(response.headers.get('Set-Cookie')).toContain('SameSite=lax')
    expect(response.headers.get('Set-Cookie')).toContain('Path=/')
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=600')
  })
})
