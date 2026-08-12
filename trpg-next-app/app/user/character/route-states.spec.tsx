/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GENERIC_CHARACTER_DATA_LOAD_ERROR_MESSAGE } from '../../features/character/sheet-edit'
import CharacterError from './error'
import CharacterLoading from './loading'

afterEach(cleanup)

describe('character route states', () => {
  it('定型エラーと手動再試行を表示し、生のエラー文言は表示しない', () => {
    const reset = jest.fn()
    const rawErrorMessage = 'connect ECONNREFUSED internal-api:3000'
    render(
      <MantineProvider>
        <CharacterError error={new Error(rawErrorMessage)} reset={reset} />
      </MantineProvider>
    )

    expect(screen.getByText(GENERIC_CHARACTER_DATA_LOAD_ERROR_MESSAGE)).toBeTruthy()
    expect(document.body.textContent ?? '').not.toContain(rawErrorMessage)
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('一覧スケルトンを表示する', () => {
    const { container } = render(
      <MantineProvider>
        <CharacterLoading />
      </MantineProvider>
    )

    expect(container.querySelector('.mantine-Skeleton-root')).toBeTruthy()
  })
})
