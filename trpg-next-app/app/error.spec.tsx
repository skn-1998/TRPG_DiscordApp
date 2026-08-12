/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GENERIC_DATA_LOAD_ERROR_MESSAGE } from './components/DataLoadError'
import RootError from './error'

afterEach(cleanup)

describe('root error boundary', () => {
  it('共有セルを render し、再試行を retry へ配線する', () => {
    const reset = jest.fn()
    const retry = jest.fn()
    render(
      <MantineProvider>
        <RootError error={new Error('internal error')} reset={reset} retry={retry} />
      </MantineProvider>
    )

    expect(screen.getByText(GENERIC_DATA_LOAD_ERROR_MESSAGE)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })
})
