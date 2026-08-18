jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
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
  rerollCreationRoll: jest.fn(),
  saveCharacterSheet: jest.fn(),
  updateCharacterSheetVisibility: jest.fn()
}))

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { extractApiErrorMessages, GENERIC_NETWORK_ERROR_MESSAGE } from '../../lib/api-response.util'
import { requireJwt } from '../../lib/auth-guard.server'
import {
  getUserCharacterSummaries,
  rerollCreationRoll,
  saveCharacterSheet,
  updateCharacterSheetVisibility
} from './api/character.service.server'
import { refreshCharacterList, rerollSheetField, saveSheet, updateSheetVisibility } from './actions'

const mockedRevalidatePath = jest.mocked(revalidatePath)
const mockedRedirect = jest.mocked(redirect)
const mockedRequireJwt = jest.mocked(requireJwt)
const mockedExtractApiErrorMessages = jest.mocked(extractApiErrorMessages)
const actualExtractApiErrorMessages = jest.requireActual<typeof import('../../lib/api-response.util')>(
  '../../lib/api-response.util'
).extractApiErrorMessages
const mockedGetUserCharacterSummaries = jest.mocked(getUserCharacterSummaries)
const mockedSaveCharacterSheet = jest.mocked(saveCharacterSheet)
const mockedRerollCreationRoll = jest.mocked(rerollCreationRoll)
const mockedUpdateCharacterSheetVisibility = jest.mocked(updateCharacterSheetVisibility)

beforeEach(() => {
  mockedRequireJwt.mockResolvedValue(undefined)
})

describe('refreshCharacterList', () => {
  it("取得失敗時は抽出したメッセージを ' / ' で連結する", async () => {
    const error = { response: { status: 400 } }
    mockedGetUserCharacterSummaries.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['認証に失敗しました', '再ログインしてください'])

    await expect(refreshCharacterList()).resolves.toEqual({
      error: '認証に失敗しました / 再ログインしてください'
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
  })

  it('response のないネットワーク断は内部情報を含まない定型文を返す', async () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:3000')
    mockedGetUserCharacterSummaries.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['connect ECONNREFUSED 127.0.0.1:3000'])

    await expect(refreshCharacterList()).resolves.toEqual({
      error: GENERIC_NETWORK_ERROR_MESSAGE
    })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
  })

  it('API の message が空でも定型文を返す', async () => {
    const error = { response: { status: 503, data: { message: '' } } }
    mockedGetUserCharacterSummaries.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    await expect(refreshCharacterList()).resolves.toEqual({
      error: GENERIC_NETWORK_ERROR_MESSAGE
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
  })
})

describe('updateSheetVisibility', () => {
  it('更新成功時は server 応答の visibility を返して一覧を再検証する', async () => {
    mockedUpdateCharacterSheetVisibility.mockResolvedValue({ visibility: 'public' })

    await expect(updateSheetVisibility('character-1', 'public')).resolves.toEqual({ visibility: 'public' })

    expect(mockedRequireJwt).toHaveBeenCalledTimes(1)
    expect(mockedUpdateCharacterSheetVisibility).toHaveBeenCalledWith('character-1', 'public')
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/user/character')
  })

  it('response のないネットワーク断は内部情報を含まない定型文を返す', async () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:3000')
    mockedUpdateCharacterSheetVisibility.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['connect ECONNREFUSED 127.0.0.1:3000'])

    await expect(updateSheetVisibility('character-1', 'public')).resolves.toEqual({
      error: GENERIC_NETWORK_ERROR_MESSAGE
    })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
    expect(mockedRevalidatePath).not.toHaveBeenCalled()
  })

  it('API の message が空でも定型文へフォールバックする', async () => {
    const error = { response: { status: 503, data: { message: '' } } }
    mockedUpdateCharacterSheetVisibility.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    await expect(updateSheetVisibility('character-1', 'public')).resolves.toEqual({
      error: GENERIC_NETWORK_ERROR_MESSAGE
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
    expect(mockedRevalidatePath).not.toHaveBeenCalled()
  })

  it('422 相当の応答は抽出した検証エラーを返す', async () => {
    const error = {
      response: {
        status: 422,
        data: {
          success: false,
          message: 'リクエストの処理に失敗しました',
          timestamp: 1,
          error: 'visibility must be private or public'
        }
      }
    }
    mockedUpdateCharacterSheetVisibility.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    await expect(updateSheetVisibility('character-1', 'public')).resolves.toEqual({
      error: 'visibility must be private or public'
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
    expect(mockedRevalidatePath).not.toHaveBeenCalled()
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
      error: GENERIC_NETWORK_ERROR_MESSAGE,
      retryable: true
    })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
  })

  it('API の message が空でも定型文を返し、5xx の再試行可分類を維持する', async () => {
    const error = { response: { status: 503, data: { message: '' } } }
    mockedSaveCharacterSheet.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    await expect(saveSheet('character-1', { baseRevision: 1, changes: [] })).resolves.toEqual({
      error: GENERIC_NETWORK_ERROR_MESSAGE,
      retryable: true
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
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

describe('rerollSheetField', () => {
  const roll = {
    revision: 3,
    fieldUid: 'uid-dex',
    notation: '3d6*5',
    total: 55,
    details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55',
    value: { parts: { base: 55 } }
  }

  it('成功時は wire をそのまま返し、シート面だけを再検証して redirect しない', async () => {
    mockedRerollCreationRoll.mockResolvedValue(roll)

    await expect(rerollSheetField('character-1', 'uid-dex', 2)).resolves.toEqual({ error: null, roll })

    expect(mockedRequireJwt).toHaveBeenCalledTimes(1)
    expect(mockedRerollCreationRoll).toHaveBeenCalledWith({
      characterId: 'character-1',
      fieldUid: 'uid-dex',
      baseRevision: 2
    })
    // 一覧（CharacterSummaryWire）はシート値を持たないため対象外。振り直しは画面に留まる操作なので redirect しない。
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/user/character/character-1/sheet')
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('409 は再試行不可の競合として汎用文言を返し、再検証しない', async () => {
    mockedRerollCreationRoll.mockRejectedValue({ response: { status: 409 } })

    await expect(rerollSheetField('character-1', 'uid-dex', 2)).resolves.toEqual({
      error: '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。',
      conflict: true
    })
    expect(mockedRevalidatePath).not.toHaveBeenCalled()
  })

  it('422 の未宣言 field は抽出したメッセージを返す', async () => {
    mockedRerollCreationRoll.mockRejectedValue({ response: { status: 422 } })
    mockedExtractApiErrorMessages.mockReturnValue(['field uid-dex does not declare a creation roll (scalar)'])

    await expect(rerollSheetField('character-1', 'uid-dex', 2)).resolves.toEqual({
      error: 'field uid-dex does not declare a creation roll (scalar)'
    })
    expect(mockedRevalidatePath).not.toHaveBeenCalled()
  })

  it('response のないネットワーク断は内部情報を含まない定型文を返す', async () => {
    mockedRerollCreationRoll.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3000'))

    await expect(rerollSheetField('character-1', 'uid-dex', 2)).resolves.toEqual({
      error: GENERIC_NETWORK_ERROR_MESSAGE
    })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
  })

  // Test intent: saveSheet が再試行可へ分類する status でも、振り直しは分類を返さない。
  // toEqual の完全一致が retryable の復活を検出する（再送は意図しない 2 回目の出目を作りうる）。
  it.each([
    ['429', { response: { status: 429 } }],
    ['5xx', { response: { status: 503 } }]
  ])('%s も再試行の分類を持たず文言だけを返す', async (_label, error) => {
    mockedRerollCreationRoll.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['振り直しに失敗しました'])

    await expect(rerollSheetField('character-1', 'uid-dex', 2)).resolves.toEqual({
      error: '振り直しに失敗しました'
    })
  })
})
