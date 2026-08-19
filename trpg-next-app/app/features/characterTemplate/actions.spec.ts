jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('@trpg/sheet-engine', () => {
  const actual = jest.requireActual('@trpg/sheet-engine')
  return {
    ...actual,
    normalizeTemplateLayout: jest.fn(actual.normalizeTemplateLayout)
  }
})

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
  forkSheetTemplate: jest.fn(),
  publishSheetTemplate: jest.fn(),
  updateSheetTemplate: jest.fn()
}))

jest.mock('./utils/v3Template', () => {
  const actual = jest.requireActual('./utils/v3Template')
  return {
    ...actual,
    normalizeTemplateReferences: jest.fn(actual.normalizeTemplateReferences)
  }
})

import { normalizeTemplateLayout } from '@trpg/sheet-engine'
import { redirect } from 'next/navigation'
import { extractApiErrorMessages, GENERIC_NETWORK_ERROR_MESSAGE } from '../../lib/api-response.util'
import { requireJwt } from '../../lib/auth-guard.server'
import { createCharacterFromTemplate } from '../character/api/character.service.server'
import {
  createSheetTemplate,
  deleteSheetTemplate,
  forkSheetTemplate,
  publishSheetTemplate,
  updateSheetTemplate
} from './api/sheetTemplateApi.server'
import {
  createCharacter,
  createTemplate,
  deleteTemplate,
  forkTemplate,
  importTemplate,
  saveTemplateDraft
} from './actions'
import type { CharacterSheetTemplateEntity, CreateSheetTemplateRequest } from './types/v3'
import { normalizeTemplateReferences } from './utils/v3Template'

const mockedRedirect = jest.mocked(redirect)
const mockedRequireJwt = jest.mocked(requireJwt)
const mockedCreateCharacterFromTemplate = jest.mocked(createCharacterFromTemplate)
const mockedCreateSheetTemplate = jest.mocked(createSheetTemplate)
const mockedDeleteSheetTemplate = jest.mocked(deleteSheetTemplate)
const mockedExtractApiErrorMessages = jest.mocked(extractApiErrorMessages)
// 空メッセージの抽出結果は実装依存なので、この経路だけは実物を通して検証する
const actualExtractApiErrorMessages = jest.requireActual<typeof import('../../lib/api-response.util')>(
  '../../lib/api-response.util'
).extractApiErrorMessages
const mockedForkSheetTemplate = jest.mocked(forkSheetTemplate)
const mockedNormalizeTemplateLayout = jest.mocked(normalizeTemplateLayout)
const mockedNormalizeTemplateReferences = jest.mocked(normalizeTemplateReferences)
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

  it('forkTemplate 成功後に複製した template の edit へ redirect する', async () => {
    mockedForkSheetTemplate.mockResolvedValue({ templateId: 'forked-template-1' } as never)

    await forkTemplate('template-1')

    expect(mockedRequireJwt).toHaveBeenCalledTimes(1)
    expect(mockedForkSheetTemplate).toHaveBeenCalledWith('template-1')
    expect(mockedRedirect).toHaveBeenCalledWith('/templates/forked-template-1/edit')
  })

  it('importTemplate は式参照の後に layout を正規化して create する', async () => {
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

    await importTemplate(payload)

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

  it('importTemplate は sections が非配列なら正規化せず payload をそのまま create へ渡す', async () => {
    const payload = {
      name: '壊れた構造',
      sections: {}
    } as unknown as CreateSheetTemplateRequest
    mockedCreateSheetTemplate.mockResolvedValue({ templateId: 'template-3' } as never)

    await importTemplate(payload)

    expect(mockedNormalizeTemplateReferences).not.toHaveBeenCalled()
    expect(mockedNormalizeTemplateLayout).not.toHaveBeenCalled()
    expect(mockedCreateSheetTemplate).toHaveBeenCalledWith(payload)
    expect(mockedRedirect).toHaveBeenCalledWith('/templates/template-3/edit')
  })

  it('importTemplate は sections の要素が不正でも例外化せず payload をそのまま create へ渡す', async () => {
    const payload = {
      name: '壊れた配列要素',
      sections: [{}]
    } as unknown as CreateSheetTemplateRequest
    mockedCreateSheetTemplate.mockResolvedValue({ templateId: 'template-4' } as never)

    await importTemplate(payload)

    expect(mockedNormalizeTemplateReferences).toHaveBeenCalledTimes(1)
    expect(mockedNormalizeTemplateLayout).not.toHaveBeenCalled()
    expect(mockedCreateSheetTemplate.mock.calls[0]?.[0]).toBe(payload)
    expect(mockedRedirect).toHaveBeenCalledWith('/templates/template-4/edit')
  })

  it('importTemplate は sections が非配列の API 400 を抽出メッセージの {error} に変換する', async () => {
    const payload = {
      name: '壊れた構造',
      sections: {}
    } as unknown as CreateSheetTemplateRequest
    const error = { response: { status: 400 } }
    mockedCreateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['sections must be an array', 'sections の形式が不正です'])

    await expect(importTemplate(payload)).resolves.toEqual({
      error: 'sections must be an array / sections の形式が不正です'
    })
    expect(mockedNormalizeTemplateReferences).not.toHaveBeenCalled()
    expect(mockedNormalizeTemplateLayout).not.toHaveBeenCalled()
    expect(mockedCreateSheetTemplate).toHaveBeenCalledWith(payload)
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('createCharacter は trim 後の characterName が空なら旧必須文言を返す', async () => {
    await expect(
      createCharacter({ templateId: 'template-1', templateVersion: '1.0.0', characterName: '   ' })
    ).resolves.toEqual({ error: 'テンプレートとキャラクター名を入力してください' })
    expect(mockedCreateCharacterFromTemplate).not.toHaveBeenCalled()
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('createCharacter は作成時の出目が空なら character 一覧へ redirect する', async () => {
    mockedCreateCharacterFromTemplate.mockResolvedValue({
      characterId: 'character-1',
      rollOnCreateResults: []
    })

    await createCharacter({ templateId: 'template-1', templateVersion: '1.0.0', characterName: ' 探索者 ' })

    expect(mockedCreateCharacterFromTemplate).toHaveBeenCalledWith({
      templateId: 'template-1',
      templateVersion: '1.0.0',
      characterName: '探索者'
    })
    expect(mockedRedirect).toHaveBeenCalledWith('/user/character')
  })

  it('createCharacter は作成時の出目が非空なら redirect せず結果を返す', async () => {
    const rollOnCreateResults = [
      {
        uid: 'uid-dex',
        label: 'DEX',
        notation: '3d6*5',
        total: 55,
        details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55'
      },
      {
        uid: 'uid-luck',
        label: '幸運',
        notation: '3d6*5',
        total: 65,
        details: '(3D6*5) ＞ 13[3,4,6]*5 ＞ 65'
      }
    ]
    mockedCreateCharacterFromTemplate.mockResolvedValue({
      characterId: 'character-1',
      rollOnCreateResults
    })

    await expect(
      createCharacter({ templateId: 'template-1', templateVersion: '1.0.0', characterName: ' 探索者 ' })
    ).resolves.toEqual({ error: null, rollOnCreateResults })

    expect(mockedRedirect).not.toHaveBeenCalled()
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

  it('forkTemplate は API 失敗時に抽出したメッセージを返す', async () => {
    const error = { response: { status: 400 } }
    mockedForkSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['複製に失敗しました'])

    await expect(forkTemplate('template-1')).resolves.toEqual({ error: '複製に失敗しました' })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('createTemplate は API の message が空でも定型文を返す', async () => {
    const error = { response: { status: 503, data: { message: '' } } }
    mockedCreateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    await expect(createTemplate()).resolves.toEqual({ error: GENERIC_NETWORK_ERROR_MESSAGE })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
  })

  it('forkTemplate は API の message が空でも定型文を返す', async () => {
    const error = { response: { status: 503, data: { message: '' } } }
    mockedForkSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    await expect(forkTemplate('template-1')).resolves.toEqual({ error: GENERIC_NETWORK_ERROR_MESSAGE })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
  })

  it('importTemplate は API の message が空でも定型文を返す', async () => {
    const error = { response: { status: 503, data: { message: '' } } }
    mockedCreateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    await expect(importTemplate({ name: 'V2 移行' })).resolves.toEqual({
      error: GENERIC_NETWORK_ERROR_MESSAGE
    })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
  })

  it('deleteTemplate は API の message が空でも定型文を返す', async () => {
    const error = { response: { status: 503, data: { message: '' } } }
    mockedDeleteSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    await expect(deleteTemplate('template-1')).resolves.toEqual({ error: GENERIC_NETWORK_ERROR_MESSAGE })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
  })

  it('createCharacter は API の message が空でも定型文を返す', async () => {
    const error = { response: { status: 503, data: { message: '' } } }
    mockedCreateCharacterFromTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    await expect(
      createCharacter({ templateId: 'template-1', templateVersion: '1.0.0', characterName: '探索者' })
    ).resolves.toEqual({ error: GENERIC_NETWORK_ERROR_MESSAGE })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
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

  it('publish 503 の部分成功は更新済み revision を返し、再試行で次 revision を update して publish する', async () => {
    const updated = { ...template, draftRevision: 8, updatedAt: '2026-08-06T01:00:00.000Z' }
    const retriedUpdate = { ...updated, draftRevision: 9, updatedAt: '2026-08-06T02:00:00.000Z' }
    const published = { ...retriedUpdate, status: 'published' as const, publishedAt: '2026-08-06T02:00:00.000Z' }
    const publishError = { response: { status: 503, data: { message: '' } } }
    mockedUpdateSheetTemplate
      .mockResolvedValueOnce(updated)
      .mockImplementationOnce(async (_templateId, request) => {
        if (request.draftRevision !== updated.draftRevision) {
          throw { response: { status: 409 } }
        }
        return retriedUpdate
      })
    mockedPublishSheetTemplate.mockRejectedValueOnce(publishError).mockResolvedValueOnce(published)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    const partialSuccess = await saveTemplateDraft('template-1', 'publish', template)

    expect(partialSuccess).toEqual({
      template: updated,
      messages: [GENERIC_NETWORK_ERROR_MESSAGE],
      retryable: true
    })
    const savedTemplate = partialSuccess.template
    if (!savedTemplate) throw new Error('partial success did not return the updated template')

    await expect(saveTemplateDraft('template-1', 'publish', savedTemplate)).resolves.toEqual({
      template: published
    })
    expect(mockedUpdateSheetTemplate).toHaveBeenCalledTimes(2)
    expect(mockedUpdateSheetTemplate.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ draftRevision: updated.draftRevision })
    )
    expect(mockedPublishSheetTemplate).toHaveBeenCalledTimes(2)
  })

  it('publish leg の 409 は更新済み template を返さず conflict flow を維持する', async () => {
    const updated = { ...template, draftRevision: 8 }
    const error = { response: { status: 409 } }
    mockedUpdateSheetTemplate.mockResolvedValue(updated)
    mockedPublishSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['draftRevision が競合しました'])

    await expect(saveTemplateDraft('template-1', 'publish', template)).resolves.toEqual({
      conflict: true,
      messages: ['draftRevision が競合しました']
    })
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
      messages: ['version が不正です'],
      retryable: false
    })
  })

  it('saveTemplateDraft の network 断は定型文を返し、生メッセージを抽出しない', async () => {
    const error = new Error('connect ECONNREFUSED internal-api:3000')
    mockedUpdateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue([error.message])

    await expect(saveTemplateDraft('template-1', 'autosave', template)).resolves.toEqual({
      conflict: false,
      messages: [GENERIC_NETWORK_ERROR_MESSAGE],
      retryable: true
    })
    expect(mockedExtractApiErrorMessages).not.toHaveBeenCalled()
  })

  it('saveTemplateDraft の 5xx は body が空メッセージでも定型文を返す', async () => {
    const error = { response: { status: 503, data: { message: '' } } }
    mockedUpdateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockImplementation(actualExtractApiErrorMessages)

    expect(actualExtractApiErrorMessages(error)).toEqual([])
    await expect(saveTemplateDraft('template-1', 'autosave', template)).resolves.toEqual({
      conflict: false,
      messages: [GENERIC_NETWORK_ERROR_MESSAGE],
      retryable: true
    })
  })

  it.each([
    [429, true],
    [503, true],
    [422, false]
  ])('saveTemplateDraft の status %i は retryable=%s を返す', async (status, retryable) => {
    const error = { response: { status } }
    mockedUpdateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['保存に失敗しました'])

    await expect(saveTemplateDraft('template-1', 'autosave', template)).resolves.toEqual({
      conflict: false,
      messages: ['保存に失敗しました'],
      retryable
    })
  })
})
