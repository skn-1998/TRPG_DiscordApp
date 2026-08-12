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

  it('401 なら soft degrade 形を返す', async () => {
    mockJwtCookie('expired-jwt')
    mockedApiGet.mockRejectedValue({ response: { status: 401 } })

    await expect(getCharacterListData()).resolves.toEqual({
      characters: [],
      error: 'Failed to load characters',
      isAuthenticated: false
    })
  })

  it('403 なら soft degrade 形を返す', async () => {
    mockJwtCookie('forbidden-jwt')
    mockedApiGet.mockRejectedValue({ response: { status: 403 } })

    await expect(getCharacterListData()).resolves.toEqual({
      characters: [],
      error: 'Failed to load characters',
      isAuthenticated: false
    })
  })

  it('network 断なら取得失敗セルへ渡すため throw する', async () => {
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:3000')
    mockJwtCookie('valid-jwt')
    mockedApiGet.mockRejectedValue(networkError)

    await expect(getCharacterListData()).rejects.toBe(networkError)
  })

  it('5xx なら取得失敗セルへ渡すため throw する', async () => {
    const serverError = { response: { status: 503 } }
    mockJwtCookie('valid-jwt')
    mockedApiGet.mockRejectedValue(serverError)

    await expect(getCharacterListData()).rejects.toBe(serverError)
  })
})
