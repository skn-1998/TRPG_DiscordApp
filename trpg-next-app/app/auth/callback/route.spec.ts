jest.mock('server-only', () => ({}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

jest.mock('../../config/env.server', () => ({
  isProduction: jest.fn(() => false)
}))

jest.mock('../../features/auth/api/auth.service.server', () => ({
  buildJwtCookieOptions: jest.fn(),
  loginOrRegisterUser: jest.fn()
}))

import { cookies } from 'next/headers'
import { isProduction } from '../../config/env.server'
import { buildJwtCookieOptions, loginOrRegisterUser } from '../../features/auth/api/auth.service.server'
import { JWT_COOKIE_NAME } from '../../lib/auth-guard.server'
import { GET } from './route'

const mockedCookies = jest.mocked(cookies)
const mockedIsProduction = jest.mocked(isProduction)
const mockedBuildJwtCookieOptions = jest.mocked(buildJwtCookieOptions)
const mockedLoginOrRegisterUser = jest.mocked(loginOrRegisterUser)
const mockedCookieSet = jest.fn()
const cookieOptions = {
  httpOnly: true as const,
  secure: false,
  sameSite: 'lax' as const,
  path: '/' as const,
  maxAge: 604800
}

beforeEach(() => {
  mockedCookies.mockResolvedValue({ set: mockedCookieSet } as never)
  mockedBuildJwtCookieOptions.mockReturnValue(cookieOptions)
})

describe('GET /auth/callback', () => {
  it('code がなければ 307 で /login へ戻し、cookie を設定しない', async () => {
    const response = await GET(new Request('http://localhost:3100/auth/callback'))

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('http://localhost:3100/login')
    expect(mockedLoginOrRegisterUser).not.toHaveBeenCalled()
    expect(mockedCookieSet).not.toHaveBeenCalled()
  })

  it('交換に成功すれば 307 で /user へ進み、正本の名前と属性で JWT cookie を設定する', async () => {
    mockedLoginOrRegisterUser.mockResolvedValue({ token: 'issued-token' } as never)

    const response = await GET(new Request('http://localhost:3100/auth/callback?code=x'))

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('http://localhost:3100/user')
    expect(mockedLoginOrRegisterUser).toHaveBeenCalledWith('x')
    expect(mockedIsProduction).toHaveBeenCalled()
    expect(mockedBuildJwtCookieOptions).toHaveBeenCalledWith(false)
    expect(mockedCookieSet).toHaveBeenCalledWith(JWT_COOKIE_NAME, 'issued-token', cookieOptions)
  })

  it.each([
    ['交換が reject', () => mockedLoginOrRegisterUser.mockRejectedValue(new Error('exchange failed'))],
    ['token が空', () => mockedLoginOrRegisterUser.mockResolvedValue({ token: '' } as never)]
  ])('%s なら 307 で /login へ戻し、cookie を設定しない', async (_caseName, arrangeFailure) => {
    arrangeFailure()

    const response = await GET(new Request('http://localhost:3100/auth/callback?code=x'))

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('http://localhost:3100/login')
    expect(mockedCookieSet).not.toHaveBeenCalled()
  })
})
