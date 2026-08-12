jest.mock('server-only', () => ({}))

jest.mock('../../lib/auth-guard.server', () => ({
  requireJwt: jest.fn()
}))

jest.mock('../../lib/api-response.util', () => ({
  ...jest.requireActual('../../lib/api-response.util'),
  extractApiErrorMessages: jest.fn()
}))

jest.mock('./api/discord.service.server', () => ({
  getDiscordServers: jest.fn(),
  postCharacterToDiscord: jest.fn()
}))

import { extractApiErrorMessages, GENERIC_NETWORK_ERROR_MESSAGE } from '../../lib/api-response.util'
import { requireJwt } from '../../lib/auth-guard.server'
import { getDiscordServers, postCharacterToDiscord as postCharacterToDiscordRequest } from './api/discord.service.server'
import { loadDiscordServers, postCharacterToDiscord } from './actions'

const mockedExtractApiErrorMessages = jest.mocked(extractApiErrorMessages)
const mockedGetDiscordServers = jest.mocked(getDiscordServers)
const mockedPostCharacterToDiscordRequest = jest.mocked(postCharacterToDiscordRequest)
const mockedRequireJwt = jest.mocked(requireJwt)

beforeEach(() => {
  mockedRequireJwt.mockResolvedValue(undefined)
})

describe('discord actions', () => {
  it('サーバー一覧取得時の response のないネットワーク断は内部情報を含まない定型文を返す', async () => {
    const error = new Error('connect ECONNREFUSED internal-api:3000')
    mockedGetDiscordServers.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['connect ECONNREFUSED internal-api:3000'])

    await expect(loadDiscordServers()).resolves.toEqual({
      servers: [],
      error: GENERIC_NETWORK_ERROR_MESSAGE
    })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
  })

  it('キャラクター投稿時の response のないネットワーク断は内部情報を含まない定型文を返す', async () => {
    const error = new Error('connect ECONNREFUSED internal-api:3000')
    mockedPostCharacterToDiscordRequest.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['connect ECONNREFUSED internal-api:3000'])

    await expect(postCharacterToDiscord('character-1', 'guild-1')).resolves.toEqual({
      success: false,
      error: GENERIC_NETWORK_ERROR_MESSAGE
    })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
  })
})
