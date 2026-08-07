jest.mock('server-only', () => ({}))

jest.mock('../../../config/env.server', () => ({
  getDiscordApplicationId: jest.fn(),
  getHostDomain: jest.fn()
}))

jest.mock('../../../lib/api-client.server', () => ({
  apiClient: {
    post: jest.fn()
  }
}))

import { buildJwtCookieOptions, buildOauthStateCookieOptions } from './auth.service.server'

describe('buildJwtCookieOptions', () => {
  it('production の全 cookie 属性を固定する', () => {
    expect(buildJwtCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 604800
    })
  })

  it('development の全 cookie 属性を固定する', () => {
    expect(buildJwtCookieOptions(false)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 604800
    })
  })
})

describe('buildOauthStateCookieOptions', () => {
  it('production の全 cookie 属性を固定する', () => {
    expect(buildOauthStateCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600
    })
  })

  it('development の全 cookie 属性を固定する', () => {
    expect(buildOauthStateCookieOptions(false)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 600
    })
  })
})
