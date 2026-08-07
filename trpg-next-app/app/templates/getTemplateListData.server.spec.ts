jest.mock('server-only', () => ({}))

jest.mock('../features/characterTemplate/api/sheetTemplateApi.server', () => ({
  getSheetTemplateSummaries: jest.fn()
}))

jest.mock('../lib/api-response.util', () => ({
  extractApiErrorMessages: jest.fn()
}))

import { getSheetTemplateSummaries } from '../features/characterTemplate/api/sheetTemplateApi.server'
import type { CharacterSheetTemplateSummary } from '../features/characterTemplate/types/v3'
import { extractApiErrorMessages } from '../lib/api-response.util'
import { getTemplateListData } from './getTemplateListData.server'

const mockedExtractApiErrorMessages = jest.mocked(extractApiErrorMessages)
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
      summaries: [summary],
      error: null
    })
  })

  it('取得に失敗しても throw せず空一覧と連結した error を返す', async () => {
    const error = new Error('Unauthorized')
    mockedGetSheetTemplateSummaries.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['認証に失敗しました', '再ログインしてください'])

    await expect(getTemplateListData()).resolves.toEqual({
      summaries: [],
      error: '認証に失敗しました / 再ログインしてください'
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
  })
})
