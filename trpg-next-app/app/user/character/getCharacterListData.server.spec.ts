jest.mock('server-only', () => ({}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

jest.mock('../../lib/api-client.server', () => ({
  apiClient: {
    get: jest.fn()
  }
}))

import type { CharacterSummaryWire } from '@trpg/api-contract'
import { cookies } from 'next/headers'
import { apiClient } from '../../lib/api-client.server'
import { getCharacterListData } from './getCharacterListData.server'

const mockedCookies = jest.mocked(cookies)
const mockedApiGet = jest.mocked(apiClient.get)

const character: CharacterSummaryWire = {
  characterId: 'character-1',
  characterName: 'テスト探索者',
  gameSystemId: 'Cthulhu7th'
}

function mockJwtCookie(jwt?: string): void {
  mockedCookies.mockResolvedValue({
    get: jest.fn(() => (jwt ? { name: 'jwt', value: jwt } : undefined))
  } as never)
}

describe('getCharacterListData', () => {
  it('jwt がなければ API を呼ばず soft degrade 形を返す', async () => {
    mockJwtCookie()

    await expect(getCharacterListData()).resolves.toEqual({
      characters: [],
      error: 'Failed to load characters',
      isAuthenticated: false
    })
    expect(mockedApiGet).not.toHaveBeenCalled()
  })

  it('取得に成功すれば character 一覧と認証済み状態を返す', async () => {
    mockJwtCookie('valid-jwt')
    mockedApiGet.mockResolvedValue({
      data: {
        success: true,
        message: 'ok',
        timestamp: 1,
        data: [character]
      }
    } as never)

    await expect(getCharacterListData()).resolves.toEqual({
      characters: [character],
      error: null,
      isAuthenticated: true
    })
    expect(mockedApiGet).toHaveBeenCalledWith('/character/summaries')
  })

  it('取得に失敗しても throw せず soft degrade 形を返す', async () => {
    mockJwtCookie('invalid-jwt')
    mockedApiGet.mockRejectedValue(new Error('Unauthorized'))

    await expect(getCharacterListData()).resolves.toEqual({
      characters: [],
      error: 'Failed to load characters',
      isAuthenticated: false
    })
  })
})
