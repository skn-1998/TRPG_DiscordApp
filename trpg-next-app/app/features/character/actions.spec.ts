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
import { GENERIC_SHEET_NETWORK_ERROR_MESSAGE } from './sheet-edit'

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

  it('409 mergeConflict は parse 済みの競合情報を返す', async () => {
    // Fixture source: TRPG-SERVER/src/features/character-sheet/services/
    // character-sheet-operation.service.spec.ts の「決定表4」と、同 feature の
    // character-sheet-http-exception.filter.spec.ts「409 conflicts」が固定する実 wire。
    const cause = {
      characterId: 'character-1',
      conflicts: [
        {
          path: { fieldUid: 'uid-score', partsKey: 'base' },
          current: 5,
          base: 3,
          yours: 7
        }
      ],
      currentRevision: 4
    }
    mockedSaveCharacterSheet.mockRejectedValue({
      response: {
        status: 409,
        data: {
          success: false,
          message: 'リクエストの処理に失敗しました',
          timestamp: 1,
          error: 'sheet changes conflict with the current revision',
          cause
        }
      }
    })

    await expect(saveSheet('character-1', { baseRevision: 0, changes: [] })).resolves.toEqual({
      error: null,
      conflict: true,
      mergeConflict: cause
    })
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('409 retryConflict の cause は mergeConflict schema に合致せず汎用文言へ fail-back する', async () => {
    mockedSaveCharacterSheet.mockRejectedValue({
      response: {
        status: 409,
        data: {
          success: false,
          message: 'リクエストの処理に失敗しました',
          timestamp: 1,
          error: 'sheet changed repeatedly; refetch the latest revision and retry',
          cause: { characterId: 'character-1', refetchRequired: true }
        }
      }
    })

    await expect(saveSheet('character-1', { baseRevision: 1, changes: [] })).resolves.toEqual({
      error: '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。',
      conflict: true
    })
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('data のない 409 は現行の固定文言と conflict true を返す', async () => {
    mockedSaveCharacterSheet.mockRejectedValue({ response: { status: 409 } })

    await expect(saveSheet('character-1', { baseRevision: 1, changes: [] })).resolves.toEqual({
      error: '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。',
      conflict: true
    })
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('409 の cause が malformed なら現行の固定文言へ fail-back する', async () => {
    mockedSaveCharacterSheet.mockRejectedValue({
      response: {
        status: 409,
        data: {
          success: false,
          message: 'リクエストの処理に失敗しました',
          timestamp: 1,
          error: 'sheet changes conflict with the current revision',
          cause: { characterId: 'character-1', conflicts: [], currentRevision: -1 }
        }
      }
    })

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
      error: '名前は必須です / 値が不正です',
      retryable: false
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('response のないネットワーク断は内部情報を含まない定型文で再試行可に分類する', async () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:3000')
    mockedSaveCharacterSheet.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['connect ECONNREFUSED 127.0.0.1:3000'])

    await expect(saveSheet('character-1', { baseRevision: 1, changes: [] })).resolves.toEqual({
      error: GENERIC_SHEET_NETWORK_ERROR_MESSAGE,
      retryable: true
    })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
  })

  it.each([
    ['429', { response: { status: 429 } }],
    ['5xx', { response: { status: 503 } }]
  ])('%s は再試行可に分類する', async (_label, error) => {
    mockedSaveCharacterSheet.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['保存に失敗しました'])

    await expect(saveSheet('character-1', { baseRevision: 1, changes: [] })).resolves.toEqual({
      error: '保存に失敗しました',
      retryable: true
    })
  })

  it('422 は恒久エラーに分類する', async () => {
    mockedSaveCharacterSheet.mockRejectedValue({ response: { status: 422 } })
    mockedExtractApiErrorMessages.mockReturnValue(['入力値が不正です'])

    await expect(saveSheet('character-1', { baseRevision: 1, changes: [] })).resolves.toEqual({
      error: '入力値が不正です',
      retryable: false
    })
  })
})
