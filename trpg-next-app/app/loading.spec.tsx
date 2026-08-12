/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import RootLoading from './loading'

afterEach(cleanup)

describe('root loading boundary', () => {
  it('汎用スケルトンを表示する', () => {
    const { container } = render(
      <MantineProvider>
        <RootLoading />
      </MantineProvider>
    )

    expect(screen.getByRole('status', { name: 'ページを読み込み中' })).toBeTruthy()
    expect(container.querySelector('.mantine-Skeleton-root')).toBeTruthy()
  })
})
