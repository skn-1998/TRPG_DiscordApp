jest.mock('server-only', () => ({}))

jest.mock('../../../lib/api-client.server', () => ({
  apiClient: {
    get: jest.fn()
  }
}))

import { apiClient } from '../../../lib/api-client.server'
import type { CharacterSheetTemplateEntity } from '../types/v3'
import { getSheetTemplate } from './sheetTemplateApi.server'

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
