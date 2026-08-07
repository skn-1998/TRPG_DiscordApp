jest.mock('server-only', () => ({}))

jest.mock('../../../config/env.server', () => ({
  getDiscordApplicationId: jest.fn(() => 'pinned-client-id'),
  getHostDomain: jest.fn(() => 'https://frontend.example.com')
}))

jest.mock('../../../lib/api-client.server', () => ({
  apiClient: {
    post: jest.fn()
  }
}))

import { generateDiscordAuthUrl } from './auth.service.server'

describe('generateDiscordAuthUrl', () => {
  it('固定 state を含む Discord OAuth URL を生成する', () => {
    const authUrl = generateDiscordAuthUrl('pinned-oauth-state')

    expect(authUrl).toBe(
      'https://discord.com/oauth2/authorize?client_id=pinned-client-id&response_type=code&redirect_uri=https%3A%2F%2Ffrontend.example.com%2Flogin&scope=identify+email+guilds&state=pinned-oauth-state'
    )

    const parsedUrl = new URL(authUrl)
    expect(parsedUrl.origin).toBe('https://discord.com')
    expect(parsedUrl.pathname).toBe('/oauth2/authorize')
    expect(Object.fromEntries(parsedUrl.searchParams)).toEqual({
      client_id: 'pinned-client-id',
      response_type: 'code',
      redirect_uri: 'https://frontend.example.com/login',
      scope: 'identify email guilds',
      state: 'pinned-oauth-state'
    })
  })
})
