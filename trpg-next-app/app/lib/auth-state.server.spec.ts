jest.mock('server-only', () => ({}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

jest.mock('./api-client.server', () => ({
  apiClient: {
    get: jest.fn()
  }
}))

import type { UserProfileWire } from '@trpg/api-contract'
import { cookies } from 'next/headers'
import { apiClient } from './api-client.server'
import { getAuthState } from './auth-state.server'

const mockedCookies = jest.mocked(cookies)
const mockedApiGet = jest.mocked(apiClient.get)

const user: UserProfileWire = {
  discordUserId: '1234567890',
  name: 'テストユーザー',
  avatarHash: 'avatar-hash',
  characterIds: ['character-1']
}

function mockJwtCookie(jwt?: string): void {
  mockedCookies.mockResolvedValue({
    get: jest.fn(() => (jwt ? { name: 'jwt', value: jwt } : undefined))
  } as never)
}

describe('getAuthState', () => {
  it('jwt がなければ API を呼ばず logged-out 形を返す', async () => {
    mockJwtCookie()

    await expect(getAuthState()).resolves.toEqual({
      user: null
    })
    expect(mockedApiGet).not.toHaveBeenCalled()
  })

  it('jwt の検証に成功すればユーザーを含む logged-in 形を返す', async () => {
    mockJwtCookie('valid-jwt')
    mockedApiGet.mockResolvedValue({
      data: {
        success: true,
        message: 'ok',
        timestamp: 1,
        data: user
      }
    } as never)

    await expect(getAuthState()).resolves.toEqual({
      user
    })
    expect(mockedApiGet).toHaveBeenCalledWith('/users')
  })

  it('jwt の検証に失敗しても throw せず logged-out 形を返す', async () => {
    mockJwtCookie('invalid-jwt')
    mockedApiGet.mockRejectedValue(new Error('Unauthorized'))

    await expect(getAuthState()).resolves.toEqual({
      user: null
    })
  })
})
