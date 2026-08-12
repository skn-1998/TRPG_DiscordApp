jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../../lib/api-client.server', () => ({
  apiClient: {
    get: jest.fn()
  }
}))

import type { CharacterSummaryWire } from '@trpg/api-contract'
import { redirect } from 'next/navigation'
import { apiClient } from '../../lib/api-client.server'
import { getCharacterListData } from './getCharacterListData.server'

const mockedRedirect = jest.mocked(redirect)
const mockedApiGet = jest.mocked(apiClient.get)

const character: CharacterSummaryWire = {
  characterId: 'character-1',
  characterName: 'テスト探索者',
  gameSystemId: 'Cthulhu7th',
  visibility: 'private'
}

describe('getCharacterListData', () => {
  it('取得に成功すれば character 一覧を返す', async () => {
    mockedApiGet.mockResolvedValue({
      data: {
        success: true,
        message: 'ok',
        timestamp: 1,
        data: [character]
      }
    } as never)

    await expect(getCharacterListData()).resolves.toEqual({
      characters: [character]
    })
    expect(mockedApiGet).toHaveBeenCalledWith('/character/summaries')
  })

  it.each([401, 403])('%i なら login へ redirect する', async (status) => {
    const authError = { response: { status } }
    mockedApiGet.mockRejectedValue(authError)

    await expect(getCharacterListData()).rejects.toBe(authError)
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  it('network 断なら取得失敗セルへ渡すため throw する', async () => {
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:3000')
    mockedApiGet.mockRejectedValue(networkError)

    await expect(getCharacterListData()).rejects.toBe(networkError)
  })

  it('5xx なら取得失敗セルへ渡すため throw する', async () => {
    const serverError = { response: { status: 503 } }
    mockedApiGet.mockRejectedValue(serverError)

    await expect(getCharacterListData()).rejects.toBe(serverError)
  })
})
