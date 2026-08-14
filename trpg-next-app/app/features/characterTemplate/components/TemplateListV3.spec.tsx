/** @jest-environment jsdom */

jest.mock('../actions', () => ({
  createCharacter: jest.fn(),
  createTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  importV2Template: jest.fn()
}))

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { createCharacter, createTemplate } from '../actions'
import type { CharacterSheetTemplateSummary } from '../types/v3'
import { TemplateListV3 } from './TemplateListV3'

const mockedCreateCharacter = jest.mocked(createCharacter)
const mockedCreateTemplate = jest.mocked(createTemplate)

const publishedSummary: CharacterSheetTemplateSummary = {
  templateId: 'template-1',
  name: 'テストテンプレート',
  version: '1.0.0',
  schemaVersion: 3,
  tags: [],
  visibility: 'private',
  authorDiscordUserId: 'user-1',
  status: 'published',
  draftRevision: 1
}

const anotherPublishedSummary: CharacterSheetTemplateSummary = {
  ...publishedSummary,
  templateId: 'template-2',
  name: '別テンプレート',
  version: '2.0.0'
}

const rollOnCreateResults = [
  {
    uid: 'uid-dex',
    label: 'DEX',
    notation: '3d6*5',
    total: 55,
    details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55'
  },
  {
    uid: 'uid-luck',
    label: '幸運',
    notation: '3d6*5',
    total: 65,
    details: '(3D6*5) ＞ 13[3,4,6]*5 ＞ 65'
  }
]

function deferredCharacterCreation() {
  type CreateResult = Awaited<ReturnType<typeof createCharacter>>
  let resolve!: (result: CreateResult) => void
  const promise = new Promise<CreateResult>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function openCharacterCreation(templateButtonIndex = 0): Promise<void> {
  const openButton = screen.getAllByRole('button', { name: 'このテンプレートで作成' })[templateButtonIndex]
  if (!openButton) throw new Error('キャラクター作成ボタンが見つかりません')
  fireEvent.click(openButton)
  await screen.findByRole('textbox', { name: 'キャラクター名' })
}

async function submitCharacterCreation(): Promise<void> {
  await openCharacterCreation()
  fireEvent.change(screen.getByRole('textbox', { name: 'キャラクター名' }), {
    target: { value: '探索者' }
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
  })
}

afterEach(cleanup)

describe('TemplateListV3', () => {
  it('server error prop なしでも list action のエラーを表示する', async () => {
    mockedCreateTemplate.mockResolvedValue({ error: GENERIC_NETWORK_ERROR_MESSAGE })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[]} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: '新規作成' }))

    expect(await screen.findByText(GENERIC_NETWORK_ERROR_MESSAGE)).toBeTruthy()
    expect(screen.getByText('テンプレートがありません')).toBeTruthy()
  })

  it('キャラクター作成 action のエラーをモーダル内に表示する', async () => {
    mockedCreateCharacter.mockResolvedValue({
      error: GENERIC_NETWORK_ERROR_MESSAGE,
      rollOnCreateResults
    })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary]} />
      </MantineProvider>
    )

    await submitCharacterCreation()

    expect(await screen.findAllByText(GENERIC_NETWORK_ERROR_MESSAGE)).toHaveLength(2)
    expect(screen.queryByText(`${rollOnCreateResults[0]?.label}: ${rollOnCreateResults[0]?.details}`)).toBeNull()
    expect(screen.queryByRole('link', { name: 'キャラクター一覧へ' })).toBeNull()
  })

  it('作成時の出目が非空なら label と details を表示し、一覧遷移で Modal をリセットする', async () => {
    mockedCreateCharacter.mockResolvedValue({ error: null, rollOnCreateResults })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary]} />
      </MantineProvider>
    )

    await submitCharacterCreation()

    for (const result of rollOnCreateResults) {
      expect(await screen.findByText(`${result.label}: ${result.details}`)).toBeTruthy()
      expect(screen.queryByText(String(result.total))).toBeNull()
    }
    const characterListLink = screen.getByRole('link', { name: 'キャラクター一覧へ' })
    expect(characterListLink.getAttribute('href')).toBe('/user/character')

    characterListLink.addEventListener('click', (event) => event.preventDefault(), { once: true })
    await act(async () => {
      fireEvent.click(characterListLink)
    })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('close 後に完了した旧リクエストは別テンプレートの Modal 状態を上書きしない', async () => {
    const pending = deferredCharacterCreation()
    mockedCreateCharacter.mockReturnValueOnce(pending.promise)
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary, anotherPublishedSummary]} />
      </MantineProvider>
    )

    await openCharacterCreation()
    fireEvent.change(screen.getByRole('textbox', { name: 'キャラクター名' }), {
      target: { value: '旧リクエスト' }
    })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => expect(mockedCreateCharacter).toHaveBeenCalledTimes(1))

    const closeButton = screen.getByRole('dialog').querySelector('button')
    if (!closeButton) throw new Error('Modal の close ボタンが見つかりません')
    fireEvent.click(closeButton)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await openCharacterCreation(1)
    expect(screen.getByText('別テンプレート / v2.0.0')).toBeTruthy()

    await act(async () => {
      pending.resolve({ error: GENERIC_NETWORK_ERROR_MESSAGE, rollOnCreateResults })
      await pending.promise
    })

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('別テンプレート / v2.0.0')).toBeTruthy()
    expect(screen.queryByText(GENERIC_NETWORK_ERROR_MESSAGE)).toBeNull()
    expect(screen.queryByText('作成時の出目')).toBeNull()
    expect((screen.getByRole('textbox', { name: 'キャラクター名' }) as HTMLInputElement).value).toBe('')
  })

  it('作成時の出目が空な redirect 経路では結果 UI を表示しない', async () => {
    mockedCreateCharacter.mockResolvedValue({ error: null, rollOnCreateResults: [] })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary]} />
      </MantineProvider>
    )

    await submitCharacterCreation()

    await waitFor(() => expect(mockedCreateCharacter).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('作成時の出目')).toBeNull()
    expect(screen.queryByRole('link', { name: 'キャラクター一覧へ' })).toBeNull()
  })
})
