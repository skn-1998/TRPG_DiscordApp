jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../features/characterTemplate/api/sheetTemplateApi.server', () => ({
  getSheetTemplateSummaries: jest.fn()
}))

import { redirect } from 'next/navigation'
import { getSheetTemplateSummaries } from '../features/characterTemplate/api/sheetTemplateApi.server'
import type { CharacterSheetTemplateSummary } from '../features/characterTemplate/types/v3'
import { getTemplateListData } from './getTemplateListData.server'

const mockedRedirect = jest.mocked(redirect)
const mockedGetSheetTemplateSummaries = jest.mocked(getSheetTemplateSummaries)

const summary: CharacterSheetTemplateSummary = {
  templateId: 'template-1',
  name: 'テストテンプレート',
  version: '1.0.0',
  schemaVersion: 3,
  tags: [],
  visibility: 'private',
  authorDiscordUserId: 'user-1',
  status: 'draft',
  draftRevision: 1
}

describe('getTemplateListData', () => {
  it('取得に成功すれば null を除いた template summary 一覧を返す', async () => {
    mockedGetSheetTemplateSummaries.mockResolvedValue([summary, null, undefined] as never)

    await expect(getTemplateListData()).resolves.toEqual({
      summaries: [summary]
    })
  })

  it.each([401, 403])('%i なら login へ redirect する', async (status) => {
    const authError = { response: { status } }
    mockedGetSheetTemplateSummaries.mockRejectedValue(authError)

    await expect(getTemplateListData()).rejects.toBe(authError)
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  it('network 断なら取得失敗セルへ渡すため throw する', async () => {
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:3000')
    mockedGetSheetTemplateSummaries.mockRejectedValue(networkError)

    await expect(getTemplateListData()).rejects.toBe(networkError)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('5xx なら取得失敗セルへ渡すため throw する', async () => {
    const serverError = { response: { status: 503 } }
    mockedGetSheetTemplateSummaries.mockRejectedValue(serverError)

    await expect(getTemplateListData()).rejects.toBe(serverError)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })
})
