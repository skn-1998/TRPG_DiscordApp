jest.mock('server-only', () => ({}))

jest.mock('../../../lib/api-client.server', () => ({
  apiClient: {
    get: jest.fn()
  }
}))

import { apiClient } from '../../../lib/api-client.server'
import type { CharacterSheetTemplateEntity } from '../types/v3'
import { extractApiErrorMessages, getSheetTemplate } from './sheetTemplateApi.server'

const mockedApiGet = jest.mocked(apiClient.get)

describe('getSheetTemplate', () => {
  it('封筒を unwrap せず response.data の entity を直接返す', async () => {
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
    mockedApiGet.mockResolvedValue({ data: template } as never)

    await expect(getSheetTemplate('template-1')).resolves.toBe(template)
    expect(mockedApiGet).toHaveBeenCalledWith('/sheet-templates/template-1')
  })
})

describe('extractApiErrorMessages', () => {
  it('ErrorEnvelope は共通復号の優先順位で issues を返す', () => {
    const error = {
      response: {
        data: {
          success: false,
          message: 'エラーが発生しました',
          timestamp: 1,
          error: '入力内容が不正です',
          issues: [{ message: '名前は必須です' }]
        }
      }
    }

    expect(extractApiErrorMessages(error)).toEqual(['名前は必須です'])
  })

  it('legacy message 配列は各要素を文字列化して返す', () => {
    const error = { response: { data: { message: ['名前は必須です', 42] } } }

    expect(extractApiErrorMessages(error)).toEqual(['名前は必須です', '42'])
  })

  it("legacy message 文字列は ';' で分割し、空白と空要素を除く", () => {
    const error = { response: { data: { message: ' 名前は必須です ; ; タグが不正です ' } } }

    expect(extractApiErrorMessages(error)).toEqual(['名前は必須です', 'タグが不正です'])
  })

  it('Error インスタンスは message を返す', () => {
    expect(extractApiErrorMessages(new Error('接続に失敗しました'))).toEqual(['接続に失敗しました'])
  })

  it('unknown はフォールバック文言を返す', () => {
    expect(extractApiErrorMessages(Symbol('unknown'))).toEqual(['リクエストの処理中にエラーが発生しました'])
  })
})
