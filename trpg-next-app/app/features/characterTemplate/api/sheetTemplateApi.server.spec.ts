jest.mock('server-only', () => ({}))

jest.mock('../../../lib/api-client.server', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn()
  }
}))

import { apiClient } from '../../../lib/api-client.server'
import type { CharacterSheetTemplateEntity } from '../types/v3'
import { forkSheetTemplate, getSheetTemplate, getSheetTemplateRevision } from './sheetTemplateApi.server'

const mockedApiGet = jest.mocked(apiClient.get)
const mockedApiPost = jest.mocked(apiClient.post)

const template: CharacterSheetTemplateEntity = {
  templateId: 'template-1',
  name: 'テストテンプレート',
  version: '1.0.0',
  schemaVersion: 3,
  tags: [],
  visibility: 'private',
  authorDiscordUserId: 'user-1',
  sections: [],
  tables: [],
  settings: { rounding: 'round' },
  status: 'draft',
  draftRevision: 1
}

afterEach(() => {
  mockedApiGet.mockReset()
  mockedApiPost.mockReset()
})

describe('getSheetTemplate', () => {
  it('封筒を unwrap せず response.data の entity を直接返す', async () => {
    mockedApiGet.mockResolvedValue({ data: template } as never)

    await expect(getSheetTemplate('template-1')).resolves.toBe(template)
    expect(mockedApiGet).toHaveBeenCalledWith('/sheet-templates/template-1')
  })
})

describe('getSheetTemplateRevision', () => {
  it('pin 用の revision パスを引き、封筒を unwrap せず entity を直接返す', async () => {
    mockedApiGet.mockResolvedValue({ data: template } as never)

    await expect(getSheetTemplateRevision('template-1', '1.2.0')).resolves.toBe(template)
    expect(mockedApiGet).toHaveBeenCalledWith('/sheet-templates/template-1/revisions/1.2.0')
  })

  // パス区切りの `/` だけを個別置換する実装（例: replaceAll('/', '%2F')）は `?` `#` `%` 空白を
  // 素通しさせ、クエリ/フラグメント混入や不正 escape を招く。予約文字を並べた入力で退行を赤にする。
  it('version はユーザー自由記述なので予約文字を漏れなく encode する', async () => {
    mockedApiGet.mockResolvedValue({ data: template } as never)

    await getSheetTemplateRevision('template-1', 'feature/1?x#y% z')

    expect(mockedApiGet).toHaveBeenCalledWith(
      '/sheet-templates/template-1/revisions/feature%2F1%3Fx%23y%25%20z'
    )
  })
})

describe('forkSheetTemplate', () => {
  it('body なしで fork パスへ POST し response.data の entity を直接返す', async () => {
    mockedApiPost.mockResolvedValue({ data: template } as never)

    await expect(forkSheetTemplate('template-1')).resolves.toBe(template)
    expect(mockedApiPost).toHaveBeenCalledWith('/sheet-templates/template-1/fork', undefined)
  })
})
