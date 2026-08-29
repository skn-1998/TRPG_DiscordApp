/** @jest-environment jsdom */

jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../../../lib/auth-guard.server', () => ({
  requireJwt: jest.fn()
}))

jest.mock('../../../features/characterTemplate/api/sheetTemplateApi.server', () => ({
  getSheetTemplateRevision: jest.fn()
}))

jest.mock('../../../features/characterTemplate/components/CharacterCreationForm', () => ({
  CharacterCreationForm: ({ template }: { template: { name: string } }) => (
    <div data-character-creation-form>{template.name}</div>
  )
}))

import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import { getSheetTemplateRevision } from '../../../features/characterTemplate/api/sheetTemplateApi.server'
import type { CharacterSheetTemplateEntity } from '../../../features/characterTemplate/types/v3'
import { requireJwt } from '../../../lib/auth-guard.server'
import CharacterCreatePage from './page'

const mockedGetSheetTemplateRevision = jest.mocked(getSheetTemplateRevision)
const mockedRedirect = jest.mocked(redirect)
const mockedRequireJwt = jest.mocked(requireJwt)

const publishedTemplate: CharacterSheetTemplateEntity = {
  templateId: 'template-1',
  status: 'published',
  version: '1.0.0',
  schemaVersion: 3,
  name: '探索者テンプレート',
  tags: [],
  visibility: 'public',
  authorDiscordUserId: 'author-1',
  sections: [],
  tables: [],
  settings: { rounding: 'floor' },
  draftRevision: 1
}

function pageProps(version?: string | string[]) {
  return {
    params: Promise.resolve({ id: 'template-1' }),
    searchParams: Promise.resolve({ version })
  }
}

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
})

describe('character create route states', () => {
  it('指定された公開バージョンを取得して作成フォームへ渡す', async () => {
    mockedGetSheetTemplateRevision.mockResolvedValue(publishedTemplate)

    const page = await CharacterCreatePage(pageProps('1.0.0'))
    render(<MantineProvider>{page}</MantineProvider>)

    expect(mockedRequireJwt).toHaveBeenCalledTimes(1)
    expect(mockedGetSheetTemplateRevision).toHaveBeenCalledWith('template-1', '1.0.0')
    expect(screen.getByText('探索者テンプレート')).toBeTruthy()
  })

  it('version が無い場合は API を呼ばず選び直しを案内する', async () => {
    const page = await CharacterCreatePage(pageProps())
    render(<MantineProvider>{page}</MantineProvider>)

    expect(mockedGetSheetTemplateRevision).not.toHaveBeenCalled()
    expect(screen.getByText('公開済みテンプレートのバージョンを選び直してください。')).toBeTruthy()
  })

  it('published 以外の固定バージョンは作成フォームへ渡さない', async () => {
    mockedGetSheetTemplateRevision.mockResolvedValue({ ...publishedTemplate, status: 'deprecated' })

    const page = await CharacterCreatePage(pageProps('1.0.0'))
    render(<MantineProvider>{page}</MantineProvider>)

    expect(screen.queryByText('探索者テンプレート')).toBeNull()
    expect(screen.getByText('公開済みテンプレートのバージョンを選び直してください。')).toBeTruthy()
  })

  it('固定バージョン取得時の認証失敗は login へ遷移する', async () => {
    const authError = { response: { status: 401 } }
    mockedGetSheetTemplateRevision.mockRejectedValue(authError)

    await expect(CharacterCreatePage(pageProps('1.0.0'))).rejects.toBe(authError)
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })
})
