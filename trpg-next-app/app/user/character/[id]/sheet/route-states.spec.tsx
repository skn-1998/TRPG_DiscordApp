/** @jest-environment jsdom */

jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../../../../features/character/api/character.service.server', () => ({
  getCharacter: jest.fn()
}))

jest.mock('../../../../features/character/components/CharacterSheetEditClient', () => ({
  CharacterSheetEditClient: () => null
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

describe('character sheet page auth failures', () => {
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
})
