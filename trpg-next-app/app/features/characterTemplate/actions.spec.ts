jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../../lib/auth-guard.server', () => ({
  requireJwt: jest.fn()
}))

jest.mock('../character/api/character.service.server', () => ({
  createCharacterFromTemplate: jest.fn()
}))

jest.mock('./api/sheetTemplateApi.server', () => ({
  createSheetTemplate: jest.fn(),
  deleteSheetTemplate: jest.fn(),
  extractApiErrorMessages: jest.fn()
}))

import { redirect } from 'next/navigation'
import { requireJwt } from '../../lib/auth-guard.server'
import { createCharacterFromTemplate } from '../character/api/character.service.server'
import {
  createSheetTemplate,
  deleteSheetTemplate,
  extractApiErrorMessages
} from './api/sheetTemplateApi.server'
import { createCharacter, createTemplate, deleteTemplate } from './actions'

const mockedRedirect = jest.mocked(redirect)
const mockedRequireJwt = jest.mocked(requireJwt)
const mockedCreateCharacterFromTemplate = jest.mocked(createCharacterFromTemplate)
const mockedCreateSheetTemplate = jest.mocked(createSheetTemplate)
const mockedDeleteSheetTemplate = jest.mocked(deleteSheetTemplate)
const mockedExtractApiErrorMessages = jest.mocked(extractApiErrorMessages)

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
    const error = new Error('Bad Request')
    mockedCreateSheetTemplate.mockRejectedValue(error)
    mockedExtractApiErrorMessages.mockReturnValue(['名前は必須です', '値が不正です'])

    await expect(createTemplate()).resolves.toEqual({ error: '名前は必須です / 値が不正です' })
    expect(mockedExtractApiErrorMessages).toHaveBeenCalledWith(error)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })
})
