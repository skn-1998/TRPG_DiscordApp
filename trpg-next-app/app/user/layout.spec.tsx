jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../features/users/components/UserPageNav', () => ({
  UserPageNav: () => null
}))

jest.mock('../lib/auth-guard.server', () => ({
  requireJwt: jest.fn()
}))

jest.mock('../lib/auth-state.server', () => ({
  getAuthState: jest.fn()
}))

import type { UserProfileWire } from '@trpg/api-contract'
import { redirect } from 'next/navigation'
import { requireJwt } from '../lib/auth-guard.server'
import { getAuthState } from '../lib/auth-state.server'
import UserLayout from './layout'

const mockedRedirect = jest.mocked(redirect)
const mockedRequireJwt = jest.mocked(requireJwt)
const mockedGetAuthState = jest.mocked(getAuthState)

const user: UserProfileWire = {
  discordUserId: '1234567890',
  name: 'テストユーザー',
  avatarHash: 'avatar-hash',
  characterIds: ['character-1']
}

describe('UserLayout auth-state branches', () => {
  beforeEach(() => {
    mockedRequireJwt.mockResolvedValue(undefined)
  })

  it('infrastructure failure のフラグがあれば root error 境界へ渡すため throw する', async () => {
    mockedGetAuthState.mockResolvedValue({
      user: null,
      degradedByInfraFailure: true
    })

    await expect(UserLayout({ children: <div>content</div> })).rejects.toThrow(
      '認証状態を取得できませんでした'
    )
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('フラグなしの user null は login へ redirect する', async () => {
    mockedGetAuthState.mockResolvedValue({ user: null })

    await expect(UserLayout({ children: <div>content</div> })).resolves.toBeTruthy()
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  it('user があれば redirect せず正常に render する', async () => {
    mockedGetAuthState.mockResolvedValue({ user })

    await expect(UserLayout({ children: <div>content</div> })).resolves.toBeTruthy()
    expect(mockedRedirect).not.toHaveBeenCalled()
  })
})
