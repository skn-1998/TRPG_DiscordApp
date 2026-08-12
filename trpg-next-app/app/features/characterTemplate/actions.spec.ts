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

jest.mock('../character/api/character.service.server', () => ({
  createCharacterFromTemplate: jest.fn()
}))

jest.mock('./api/sheetTemplateApi.server', () => ({
  createSheetTemplate: jest.fn(),
  deleteSheetTemplate: jest.fn(),
  publishSheetTemplate: jest.fn(),
  updateSheetTemplate: jest.fn()
}))

import { redirect } from 'next/navigation'
import { extractApiErrorMessages, GENERIC_NETWORK_ERROR_MESSAGE } from '../../lib/api-response.util'
import { requireJwt } from '../../lib/auth-guard.server'
import { createCharacterFromTemplate } from '../character/api/character.service.server'
import {
  createSheetTemplate,
  deleteSheetTemplate,
  publishSheetTemplate,
  updateSheetTemplate
} from './api/sheetTemplateApi.server'
import { createCharacter, createTemplate, deleteTemplate, importV2Template, saveTemplateDraft } from './actions'
import type { CharacterSheetTemplateEntity, CreateSheetTemplateRequest } from './types/v3'

const mockedRedirect = jest.mocked(redirect)
const mockedRequireJwt = jest.mocked(requireJwt)
const mockedCreateCharacterFromTemplate = jest.mocked(createCharacterFromTemplate)
const mockedCreateSheetTemplate = jest.mocked(createSheetTemplate)
const mockedDeleteSheetTemplate = jest.mocked(deleteSheetTemplate)
const mockedExtractApiErrorMessages = jest.mocked(extractApiErrorMessages)
const mockedPublishSheetTemplate = jest.mocked(publishSheetTemplate)
const mockedUpdateSheetTemplate = jest.mocked(updateSheetTemplate)

const template: CharacterSheetTemplateEntity = {
  templateId: 'template-1',
  name: '探索者テンプレート',
  version: '1.2.3',
  schemaVersion: 3,
  gameSystemId: 'Cthulhu7th',
  tags: ['CoC', '探索者'],
  visibility: 'unlisted',
  authorDiscordUserId: 'discord-user-1',
  forkedFrom: { templateId: 'source-template', version: '1.0.0' },
  license: 'CC BY 4.0',
  sections: [{ id: 'basic', label: '基本情報', fields: [] }],
  tables: [{ id: 'job', rows: [{ key: 'detective', result: '探偵' }] }],
  settings: { rounding: 'ceil' },
  status: 'draft',
  draftRevision: 7,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z'
}

beforeEach(() => {
  mockedRequireJwt.mockResolvedValue(undefined)
})

describe('characterTemplate actions', () => {
  it('createTemplate 成功後に作成した template の edit へ redirect する', async () => {
    mockedCreateSheetTemplate.mockResolvedValue({ templateId: 'template-1' } as never)

    await createTemplate()

    expect(mockedRequireJwt).toHaveBeenCalledTimes(1)
    expect(mockedCreateSheetTemplate).toHaveBeenCalledWith({
      name: '新規テンプレート',
      version: '0.1.0',
      schemaVersion: 3,
      visibility: 'private',
      tags: [],
      sections: [{ id: 'basic', label: '基本情報', fields: [] }],
      tables: [],
      settings: { rounding: 'floor' }
    })
    expect(mockedRedirect).toHaveBeenCalledWith('/templates/template-1/edit')
  })

  it('importV2Template は式参照の後に layout を正規化して create する', async () => {
    const payload: CreateSheetTemplateRequest = {
      name: 'V2 移行',
      sections: [
        {
          id: 'status',
          label: 'ステータス',
          layout: { preset: 'grid' },
          fields: [
            { id: 'hp', uid: 'uid_hp', label: 'HP', type: 'scalar', valueType: 'number' },
            {
              id: 'double_hp',
              uid: 'uid_double_hp',
              label: 'HP x2',
              type: 'computed',
              resultType: 'number',
              formula: '{hp} * 2',
              layout: {}
            }
          ]
        }
      ]
    }
    mockedCreateSheetTemplate.mockResolvedValue({ templateId: 'template-2' } as never)

    await importV2Template(payload)

    expect(mockedCreateSheetTemplate).toHaveBeenCalledWith({
      ...payload,
      sections: [
        {
          ...payload.sections?.[0],
          layout: { preset: 'grid', columns: 2 },
          fields: [
            { id: 'hp', uid: 'uid_hp', label: 'HP', type: 'scalar', valueType: 'number', layout: { span: 1 } },
            {
              id: 'double_hp',
              uid: 'uid_double_hp',
              label: 'HP x2',
              type: 'computed',
              resultType: 'number',
              formula: '{status.hp} * 2',
              layout: { span: 1 }
            }
          ]
        }
      ]
    })
    expect(mockedRedirect).toHaveBeenCalledWith('/templates/template-2/edit')
  })

  it('createCharacter は trim 後の characterName が空なら旧必須文言を返す', async () => {
    await expect(
      createCharacter({ templateId: 'template-1', templateVersion: '1.0.0', characterName: '   ' })
    ).resolves.toEqual({ error: 'テンプレートとキャラクター名を入力してください' })
    expect(mockedCreateCharacterFromTemplate).not.toHaveBeenCalled()
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('createCharacter 成功後に character 一覧へ redirect する', async () => {
    mockedCreateCharacterFromTemplate.mockResolvedValue({} as never)

    await createCharacter({ templateId: 'template-1', templateVersion: '1.0.0', characterName: ' 探索者 ' })

    expect(mockedCreateCharacterFromTemplate).toHaveBeenCalledWith({
      templateId: 'template-1',
      templateVersion: '1.0.0',
      characterName: '探索者'
    })
    expect(mockedRedirect).toHaveBeenCalledWith('/user/character')
  })

  it('deleteTemplate 成功後に template 一覧へ redirect する', async () => {
    mockedDeleteSheetTemplate.mockResolvedValue(undefined)

    await deleteTemplate('template-1')

    expect(mockedDeleteSheetTemplate).toHaveBeenCalledWith('template-1')
    expect(mockedRedirect).toHaveBeenCalledWith('/templates')
  })

  it("API 失敗時は抽出したメッセージを ' / ' で連結する", async () => {
    const error = { response: { status: 400 } }
    mockedCreateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['名前は必須です', '値が不正です'])

    await expect(createTemplate()).resolves.toEqual({ error: '名前は必須です / 値が不正です' })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('createTemplate の network 断は定型文を返し、生メッセージを抽出しない', async () => {
    const error = new Error('connect ECONNREFUSED internal-api:3000')
    mockedCreateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue([error.message])

    await expect(createTemplate()).resolves.toEqual({ error: GENERIC_NETWORK_ERROR_MESSAGE })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
  })

  it('saveTemplateDraft の save 成功時は全キーを update へ渡し publish しない', async () => {
    const updated = { ...template, draftRevision: 8 }
    mockedUpdateSheetTemplate.mockResolvedValue(updated)

    await expect(saveTemplateDraft('template-1', 'save', template)).resolves.toEqual({
      template: updated
    })

    expect(mockedRequireJwt).toHaveBeenCalledTimes(1)
    expect(mockedUpdateSheetTemplate).toHaveBeenCalledWith('template-1', {
      draftRevision: 7,
      name: '探索者テンプレート',
      version: '1.2.3',
      schemaVersion: 3,
      gameSystemId: 'Cthulhu7th',
      tags: ['CoC', '探索者'],
      visibility: 'unlisted',
      forkedFrom: { templateId: 'source-template', version: '1.0.0' },
      license: 'CC BY 4.0',
      sections: [{ id: 'basic', label: '基本情報', fields: [] }],
      tables: [{ id: 'job', rows: [{ key: 'detective', result: '探偵' }] }],
      settings: { rounding: 'ceil' }
    })
    expect(mockedPublishSheetTemplate).not.toHaveBeenCalled()
  })

  it('saveTemplateDraft の publish 成功時は update 後の publish entity を返す', async () => {
    const updated = { ...template, draftRevision: 8 }
    const published = { ...updated, status: 'published' as const, publishedAt: '2026-08-06T01:00:00.000Z' }
    mockedUpdateSheetTemplate.mockResolvedValue(updated)
    mockedPublishSheetTemplate.mockResolvedValue(published)

    await expect(saveTemplateDraft('template-1', 'publish', template)).resolves.toEqual({
      template: published
    })

    expect(mockedUpdateSheetTemplate).toHaveBeenCalledTimes(1)
    expect(mockedPublishSheetTemplate).toHaveBeenCalledWith('template-1')
    expect(mockedUpdateSheetTemplate.mock.invocationCallOrder[0]).toBeLessThan(
      mockedPublishSheetTemplate.mock.invocationCallOrder[0]
    )
  })

  it('saveTemplateDraft の 409 は conflict true と抽出メッセージを返す', async () => {
    const error = { response: { status: 409 } }
    mockedUpdateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['draftRevision が競合しました'])

    await expect(saveTemplateDraft('template-1', 'autosave', template)).resolves.toEqual({
      conflict: true,
      messages: ['draftRevision が競合しました']
    })
  })

  it('saveTemplateDraft の 409 以外は conflict false と抽出メッセージを返す', async () => {
    const error = { response: { status: 400 } }
    mockedUpdateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['version が不正です'])

    await expect(saveTemplateDraft('template-1', 'save', template)).resolves.toEqual({
      conflict: false,
      messages: ['version が不正です']
    })
  })

  it('saveTemplateDraft の network 断は定型文を返し、生メッセージを抽出しない', async () => {
    const error = new Error('connect ECONNREFUSED internal-api:3000')
    mockedUpdateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue([error.message])

    await expect(saveTemplateDraft('template-1', 'autosave', template)).resolves.toEqual({
      conflict: false,
      messages: [GENERIC_NETWORK_ERROR_MESSAGE]
    })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
  })
})
