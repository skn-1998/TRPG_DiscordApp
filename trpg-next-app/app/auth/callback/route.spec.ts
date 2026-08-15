jest.mock('server-only', () => ({}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

jest.mock('../../config/env.server', () => ({
  getHostDomain: jest.fn(() => 'https://localhost'),
  isProduction: jest.fn(() => false)
}))

jest.mock('../../features/auth/api/auth.service.server', () => ({
  buildJwtCookieOptions: jest.fn(),
  loginOrRegisterUser: jest.fn(),
  OAUTH_STATE_COOKIE_NAME: 'oauth_state'
}))

import { cookies } from 'next/headers'
import { isProduction } from '../../config/env.server'
import {
  buildJwtCookieOptions,
  loginOrRegisterUser,
  OAUTH_STATE_COOKIE_NAME
} from '../../features/auth/api/auth.service.server'
import { JWT_COOKIE_NAME } from '../../lib/auth-guard.server'
import { GET } from './route'

const mockedCookies = jest.mocked(cookies)
const mockedIsProduction = jest.mocked(isProduction)
const mockedBuildJwtCookieOptions = jest.mocked(buildJwtCookieOptions)
const mockedLoginOrRegisterUser = jest.mocked(loginOrRegisterUser)
const mockedCookieGet = jest.fn()
const mockedCookieSet = jest.fn()
const mockedCookieDelete = jest.fn()
const oauthState = 'pinned-oauth-state'
const internalRequestOrigin = 'https://0.0.0.0:3000'
const cookieOptions = {
  httpOnly: true as const,
  secure: false,
  sameSite: 'lax' as const,
  path: '/' as const,
  maxAge: 604800
}

beforeEach(() => {
  mockedCookieGet.mockReturnValue({ value: oauthState })
  mockedCookies.mockResolvedValue({ get: mockedCookieGet, set: mockedCookieSet, delete: mockedCookieDelete } as never)
  mockedBuildJwtCookieOptions.mockReturnValue(cookieOptions)
})

describe('GET /auth/callback', () => {
  it('内部待受 URL で code がなければ、公開 origin の /login へ 307 で戻す', async () => {
    const response = await GET(new Request(`${internalRequestOrigin}/auth/callback?state=${oauthState}`))

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('https://localhost/login')
    expect(mockedLoginOrRegisterUser).not.toHaveBeenCalled()
    expect(mockedCookieSet).not.toHaveBeenCalled()
    expect(mockedCookieDelete).toHaveBeenCalledWith(OAUTH_STATE_COOKIE_NAME)
  })

  it('交換に成功すれば公開 origin の /user へ進み、正本の名前と属性で JWT cookie を設定する', async () => {
    mockedLoginOrRegisterUser.mockResolvedValue({ token: 'issued-token' } as never)

    const response = await GET(
      new Request(`${internalRequestOrigin}/auth/callback?code=x&state=${oauthState}`)
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('https://localhost/user')
    expect(mockedLoginOrRegisterUser).toHaveBeenCalledWith('x')
    expect(mockedIsProduction).toHaveBeenCalled()
    expect(mockedBuildJwtCookieOptions).toHaveBeenCalledWith(false)
    expect(mockedCookieSet).toHaveBeenCalledWith(JWT_COOKIE_NAME, 'issued-token', cookieOptions)
    expect(mockedCookieDelete).toHaveBeenCalledWith(OAUTH_STATE_COOKIE_NAME)
  })

  it.each([
    ['交換が reject', () => mockedLoginOrRegisterUser.mockRejectedValue(new Error('exchange failed'))],
    ['token が空', () => mockedLoginOrRegisterUser.mockResolvedValue({ token: '' } as never)]
  ])('%s なら 307 で /login へ戻し、cookie を設定しない', async (_caseName, arrangeFailure) => {
    arrangeFailure()

    const response = await GET(
      new Request(`${internalRequestOrigin}/auth/callback?code=x&state=${oauthState}`)
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('https://localhost/login')
    expect(mockedCookieSet).not.toHaveBeenCalled()
    expect(mockedCookieDelete).toHaveBeenCalledWith(OAUTH_STATE_COOKIE_NAME)
  })

  it('query state がなければ 307 で /login へ戻し、code を交換せず state cookie を削除する', async () => {
    const response = await GET(new Request(`${internalRequestOrigin}/auth/callback?code=x`))

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('https://localhost/login')
    expect(mockedLoginOrRegisterUser).not.toHaveBeenCalled()
    expect(mockedCookieSet).not.toHaveBeenCalled()
    expect(mockedCookieDelete).toHaveBeenCalledWith(OAUTH_STATE_COOKIE_NAME)
  })

  it('state が一致しなければ 307 で /login へ戻し、code を交換せず state cookie を削除する', async () => {
    const response = await GET(
      new Request(`${internalRequestOrigin}/auth/callback?code=x&state=unexpected-state`)
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('https://localhost/login')
    expect(mockedLoginOrRegisterUser).not.toHaveBeenCalled()
    expect(mockedCookieSet).not.toHaveBeenCalled()
    expect(mockedCookieDelete).toHaveBeenCalledWith(OAUTH_STATE_COOKIE_NAME)
  })
})
