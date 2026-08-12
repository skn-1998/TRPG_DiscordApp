/** @jest-environment jsdom */

jest.mock('../actions', () => ({
  updateSheetVisibility: jest.fn()
}))

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { updateSheetVisibility } from '../actions'
import { SheetVisibilityToggle } from './SheetVisibilityToggle'

const mockedUpdateSheetVisibility = jest.mocked(updateSheetVisibility)
const visibilityNotice =
  '公開閲覧の提供は準備中。Web では現在自分だけが見られます。Discord hub の表示はチャンネル権限に従います。公開閲覧の開始時には、公開内容の確認をあらためて求めます'

function renderToggle(initialVisibility: 'private' | 'public' = 'private') {
  return render(
    <MantineProvider>
      <SheetVisibilityToggle characterId="character-1" initialVisibility={initialVisibility} />
    </MantineProvider>
  )
}

function deferredUpdate() {
  type UpdateResult = Awaited<ReturnType<typeof updateSheetVisibility>>
  let resolve!: (result: UpdateResult) => void
  const promise = new Promise<UpdateResult>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

beforeEach(() => {
  mockedUpdateSheetVisibility.mockReset()
})

afterEach(cleanup)

describe('SheetVisibilityToggle', () => {
  it.each([
    ['private', '非公開'],
    ['public', '公開']
  ] as const)('初期値 %s を現在値として表示する', (initialVisibility, label) => {
    renderToggle(initialVisibility)

    expect(screen.getByText(`現在の設定: ${label}`)).toBeTruthy()
    expect((screen.getByRole('radio', { name: label }) as HTMLInputElement).checked).toBe(true)
  })

  it('切替時は characterId と選択値を action へ 1 回渡す', async () => {
    mockedUpdateSheetVisibility.mockResolvedValue({ visibility: 'public' })
    renderToggle()

    fireEvent.click(screen.getByRole('radio', { name: '公開' }))

    await waitFor(() => expect(mockedUpdateSheetVisibility).toHaveBeenCalledTimes(1))
    expect(mockedUpdateSheetVisibility).toHaveBeenCalledWith('character-1', 'public')
  })

  it('送信中は切替を disabled にし、連打しても二重送信しない', async () => {
    const pending = deferredUpdate()
    mockedUpdateSheetVisibility.mockReturnValue(pending.promise)
    renderToggle()
    const publicOption = screen.getByRole('radio', { name: '公開' }) as HTMLInputElement

    fireEvent.click(publicOption)

    await waitFor(() => expect(publicOption.disabled).toBe(true))
    fireEvent.click(publicOption)
    expect(mockedUpdateSheetVisibility).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({ visibility: 'public' })
      await pending.promise
    })
  })

  it('成功時は応答の visibility で表示値を更新する', async () => {
    mockedUpdateSheetVisibility.mockResolvedValue({ visibility: 'public' })
    renderToggle()

    fireEvent.click(screen.getByRole('radio', { name: '公開' }))

    expect(await screen.findByText('現在の設定: 公開')).toBeTruthy()
    expect((screen.getByRole('radio', { name: '公開' }) as HTMLInputElement).checked).toBe(true)
  })

  it('失敗時は Alert を表示し、値を元のまま維持する', async () => {
    mockedUpdateSheetVisibility.mockResolvedValue({ error: '公開設定を変更できません' })
    renderToggle()

    fireEvent.click(screen.getByRole('radio', { name: '公開' }))

    expect((await screen.findByRole('alert')).textContent).toContain('公開設定を変更できません')
    expect(screen.getByText('現在の設定: 非公開')).toBeTruthy()
    expect((screen.getByRole('radio', { name: '非公開' }) as HTMLInputElement).checked).toBe(true)
  })

  it('正本固定の注記全文を表示する', () => {
    renderToggle()

    expect(screen.getByText(visibilityNotice, { exact: true })).toBeTruthy()
  })
})
