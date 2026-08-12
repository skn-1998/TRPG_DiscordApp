/** @jest-environment jsdom */

jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../../../features/characterTemplate/api/sheetTemplateApi.server', () => ({
  getSheetTemplate: jest.fn()
}))

jest.mock('../../../features/characterTemplate/components/TemplateEditorV3', () => ({
  TemplateEditorV3: () => null
}))

jest.mock('../../../lib/auth-guard.server', () => ({
  requireJwt: jest.fn()
}))

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import { GENERIC_DATA_LOAD_ERROR_MESSAGE } from '../../../components/DataLoadError'
import { getSheetTemplate } from '../../../features/characterTemplate/api/sheetTemplateApi.server'
import { requireJwt } from '../../../lib/auth-guard.server'
import TemplateEditError from './error'
import TemplateEditLoading from './loading'
import TemplateEditPage from './page'

const mockedRedirect = jest.mocked(redirect)
const mockedGetSheetTemplate = jest.mocked(getSheetTemplate)
const mockedRequireJwt = jest.mocked(requireJwt)

afterEach(cleanup)

describe('template editor route states', () => {
  it('定型エラーと手動再試行を表示し、生のエラー文言は表示しない', () => {
    const reset = jest.fn()
    const retry = jest.fn()
    const rawErrorMessage = 'connect ECONNREFUSED internal-api:3000'
    render(
      <MantineProvider>
        <TemplateEditError error={new Error(rawErrorMessage)} reset={reset} retry={retry} />
      </MantineProvider>
    )

    expect(screen.getByText(GENERIC_DATA_LOAD_ERROR_MESSAGE)).toBeTruthy()
    expect(document.body.textContent ?? '').not.toContain(rawErrorMessage)
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })

  it('エディタスケルトンを表示する', () => {
    const { container } = render(
      <MantineProvider>
        <TemplateEditLoading />
      </MantineProvider>
    )

    expect(container.querySelector('.mantine-Skeleton-root')).toBeTruthy()
  })
})

describe('template editor page auth failures', () => {
  beforeEach(() => {
    mockedRedirect.mockReset()
    mockedGetSheetTemplate.mockReset()
    mockedRequireJwt.mockReset().mockResolvedValue(undefined)
  })

  it.each([401, 403])('getSheetTemplate の %i は login へ redirect する', async (status) => {
    const authError = { response: { status } }
    mockedGetSheetTemplate.mockRejectedValue(authError)

    await expect(TemplateEditPage({ params: Promise.resolve({ id: 'template-1' }) })).rejects.toBe(authError)
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  it('5xx は取得失敗セルへ渡すため throw する', async () => {
    const serverError = { response: { status: 503 } }
    mockedGetSheetTemplate.mockRejectedValue(serverError)

    await expect(TemplateEditPage({ params: Promise.resolve({ id: 'template-1' }) })).rejects.toBe(serverError)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })
})
