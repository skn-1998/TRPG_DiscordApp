/** @jest-environment jsdom */

jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../../../../features/character/api/character.service.server', () => ({
  getCharacter: jest.fn()
}))

jest.mock('../../../../features/character/components/CharacterSheetEditClient', () => ({
  CharacterSheetEditClient: () => <div data-testid="sheet-editor" />
}))

jest.mock('../../../../features/character/components/SheetVisibilityToggle', () => ({
  SheetVisibilityToggle: ({
    characterId,
    initialVisibility
  }: {
    characterId: string
    initialVisibility: string
  }) => (
    <div
      data-testid="sheet-visibility-toggle"
      data-character-id={characterId}
      data-visibility={initialVisibility}
    />
  )
}))

jest.mock('../../../../features/characterTemplate/api/sheetTemplateApi.server', () => ({
  getSheetTemplate: jest.fn()
}))

jest.mock('../../../../lib/auth-guard.server', () => ({
  requireJwt: jest.fn()
}))

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import { GENERIC_DATA_LOAD_ERROR_MESSAGE } from '../../../../components/DataLoadError'
import { getCharacter } from '../../../../features/character/api/character.service.server'
import { getSheetTemplate } from '../../../../features/characterTemplate/api/sheetTemplateApi.server'
import { requireJwt } from '../../../../lib/auth-guard.server'
import CharacterSheetError from './error'
import CharacterSheetLoading from './loading'
import CharacterSheetPage from './page'

const mockedRedirect = jest.mocked(redirect)
const mockedGetCharacter = jest.mocked(getCharacter)
const mockedGetSheetTemplate = jest.mocked(getSheetTemplate)
const mockedRequireJwt = jest.mocked(requireJwt)

afterEach(cleanup)

describe('character sheet route states', () => {
  it('定型エラーと手動再試行を表示し、生のエラー文言は表示しない', () => {
    const reset = jest.fn()
    const retry = jest.fn()
    const rawErrorMessage = 'connect ECONNREFUSED internal-api:3000'
    render(
      <MantineProvider>
        <CharacterSheetError error={new Error(rawErrorMessage)} reset={reset} retry={retry} />
      </MantineProvider>
    )

    expect(screen.getByText(GENERIC_DATA_LOAD_ERROR_MESSAGE)).toBeTruthy()
    expect(document.body.textContent ?? '').not.toContain(rawErrorMessage)
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })

  it('シート編集スケルトンを表示する', () => {
    const { container } = render(
      <MantineProvider>
        <CharacterSheetLoading />
      </MantineProvider>
    )

    expect(container.querySelector('.mantine-Skeleton-root')).toBeTruthy()
  })
})

describe('character sheet page', () => {
  beforeEach(() => {
    mockedRedirect.mockReset()
    mockedGetCharacter.mockReset()
    mockedGetSheetTemplate.mockReset()
    mockedRequireJwt.mockReset().mockResolvedValue(undefined)
  })

  it('getCharacter の 401 は login へ redirect する', async () => {
    const authError = { response: { status: 401 } }
    mockedGetCharacter.mockRejectedValue(authError)

    await expect(
      CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    ).rejects.toBe(authError)
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  it('getSheetTemplate の 403 は login へ redirect する', async () => {
    const authError = { response: { status: 403 } }
    mockedGetCharacter.mockResolvedValue({ sheet: { templateId: 'template-1' } } as never)
    mockedGetSheetTemplate.mockRejectedValue(authError)

    await expect(
      CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    ).rejects.toBe(authError)
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  it('5xx は取得失敗セルへ渡すため throw する', async () => {
    const serverError = { response: { status: 503 } }
    mockedGetCharacter.mockRejectedValue(serverError)

    await expect(
      CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    ).rejects.toBe(serverError)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('公開設定を初期値付きでシート編集 UI の前に配置する', async () => {
    mockedGetCharacter.mockResolvedValue({
      characterId: 'character-1',
      sheet: {
        templateId: 'template-1',
        visibility: 'public'
      }
    } as never)
    mockedGetSheetTemplate.mockResolvedValue({} as never)

    const page = await CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    render(<MantineProvider>{page}</MantineProvider>)

    const visibilityToggle = screen.getByTestId('sheet-visibility-toggle')
    const sheetEditor = screen.getByTestId('sheet-editor')
    expect(visibilityToggle.getAttribute('data-character-id')).toBe('character-1')
    expect(visibilityToggle.getAttribute('data-visibility')).toBe('public')
    expect(visibilityToggle.compareDocumentPosition(sheetEditor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
