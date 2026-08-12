/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GENERIC_DATA_LOAD_ERROR_MESSAGE } from '../components/DataLoadError'
import TemplateListError from './error'
import TemplateListLoading from './loading'

afterEach(cleanup)

describe('template list route states', () => {
  it('定型エラーと手動再試行を表示し、生のエラー文言は表示しない', () => {
    const reset = jest.fn()
    const retry = jest.fn()
    const rawErrorMessage = 'connect ECONNREFUSED internal-api:3000'
    render(
      <MantineProvider>
        <TemplateListError error={new Error(rawErrorMessage)} reset={reset} retry={retry} />
      </MantineProvider>
    )

    expect(screen.getByText(GENERIC_DATA_LOAD_ERROR_MESSAGE)).toBeTruthy()
    expect(document.body.textContent ?? '').not.toContain(rawErrorMessage)
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })

  it('一覧スケルトンを表示する', () => {
    const { container } = render(
      <MantineProvider>
        <TemplateListLoading />
      </MantineProvider>
    )

    expect(container.querySelector('.mantine-Skeleton-root')).toBeTruthy()
  })
})
