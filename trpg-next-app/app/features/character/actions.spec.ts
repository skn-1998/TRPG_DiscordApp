jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../../lib/auth-guard.server', () => ({
  requireJwt: jest.fn()
}))

jest.mock('../../lib/api-response.util', () => ({
  ...jest.requireActual('../../lib/api-response.util'),
  extractApiErrorMessages: jest.fn()
}))

jest.mock('./api/character.service.server', () => ({
  getUserCharacterSummaries: jest.fn(),
  saveCharacterSheet: jest.fn()
}))

import { redirect } from 'next/navigation'
import { extractApiErrorMessages } from '../../lib/api-response.util'
import { requireJwt } from '../../lib/auth-guard.server'
import { getUserCharacterSummaries, saveCharacterSheet } from './api/character.service.server'
import { refreshCharacterList, saveSheet } from './actions'

const mockedRedirect = jest.mocked(redirect)
const mockedRequireJwt = jest.mocked(requireJwt)
const mockedExtractApiErrorMessages = jest.mocked(extractApiErrorMessages)
const mockedGetUserCharacterSummaries = jest.mocked(getUserCharacterSummaries)
const mockedSaveCharacterSheet = jest.mocked(saveCharacterSheet)

beforeEach(() => {
  mockedRequireJwt.mockResolvedValue(undefined)
})

describe('refreshCharacterList', () => {
  it("取得失敗時は抽出したメッセージを ' / ' で連結する", async () => {
    const error = new Error('Request failed')
    mockedGetUserCharacterSummaries.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['認証に失敗しました', '再ログインしてください'])

    await expect(refreshCharacterList()).resolves.toEqual({
      error: '認証に失敗しました / 再ログインしてください'
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
  })
})

describe('saveSheet', () => {
  it("保存成功後に /user/character へ redirect する", async () => {
    mockedSaveCharacterSheet.mockResolvedValue({ revision: 2, noOp: false, appliedChanges: 1 })
    const input = {
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.hp' }, baseValue: 10, newValue: 9 }]
    }

    await saveSheet('character-1', input)

    expect(mockedRequireJwt).toHaveBeenCalledTimes(1)
    expect(mockedSaveCharacterSheet).toHaveBeenCalledWith({ characterId: 'character-1', ...input })
    expect(mockedRedirect).toHaveBeenCalledWith('/user/character')
  })

  it('409 は conflict true と競合文言を返す', async () => {
    mockedSaveCharacterSheet.mockRejectedValue({ response: { status: 409 } })

    await expect(saveSheet('character-1', { baseRevision: 1, changes: [] })).resolves.toEqual({
      error: '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。',
      conflict: true
    })
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it("409 以外は抽出したメッセージを ' / ' で連結する", async () => {
    const error = { response: { status: 400 } }
    mockedSaveCharacterSheet.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['名前は必須です', '値が不正です'])

    await expect(saveSheet('character-1', { baseRevision: 1, changes: [] })).resolves.toEqual({
      error: '名前は必須です / 値が不正です'
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })
})
