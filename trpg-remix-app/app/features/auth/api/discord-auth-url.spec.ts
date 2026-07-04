import { generateDiscordAuthUrl } from './discord-auth-url'

describe('generateDiscordAuthUrl', () => {
  it('Discord OAuth URLを末尾スラッシュなしのcallback URLで生成する', () => {
    const result = generateDiscordAuthUrl({
      applicationId: 'application-id',
      hostDomain: 'https://example.test/'
    })
    const url = new URL(result)

    expect(url.origin).toBe('https://discord.com')
    expect(url.pathname).toBe('/oauth2/authorize')
    expect(url.searchParams.get('client_id')).toBe('application-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.test/login')
    expect(url.searchParams.get('scope')).toBe('identify email guilds')
  })
})
