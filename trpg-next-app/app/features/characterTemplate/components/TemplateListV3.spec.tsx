/** @jest-environment jsdom */

jest.mock('../actions', () => ({
  createCharacter: jest.fn(),
  createTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  forkTemplate: jest.fn(),
  importTemplate: jest.fn()
}))

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { createCharacter, createTemplate, deleteTemplate, forkTemplate, importTemplate } from '../actions'
import { SYSTEM_TEMPLATE_AUTHOR } from '../constants'
import { TEMPLATE_GENERATION_PROMPT } from '../templateGenerationPrompt'
import type { CharacterSheetTemplateSummary } from '../types/v3'
import { TemplateListV3 } from './TemplateListV3'

const mockedCreateCharacter = jest.mocked(createCharacter)
const mockedCreateTemplate = jest.mocked(createTemplate)
const mockedDeleteTemplate = jest.mocked(deleteTemplate)
const mockedForkTemplate = jest.mocked(forkTemplate)
const mockedImportTemplate = jest.mocked(importTemplate)

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

const systemPublishedSummary: CharacterSheetTemplateSummary = {
  ...publishedSummary,
  templateId: 'system-template-1',
  name: '配布テンプレート',
  visibility: 'public',
  authorDiscordUserId: SYSTEM_TEMPLATE_AUTHOR
}

// details に含まれない負の対照値で、total の誤表示を部分一致でも検出する。
const rollOnCreateResults = [
  {
    uid: 'uid-dex',
    label: 'DEX',
    notation: '3d6*5',
    total: 987654321,
    details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55'
  },
  {
    uid: 'uid-luck',
    label: '幸運',
    notation: '3d6*5',
    total: 876543210,
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
  it('JSON から作成ボタンでテンプレート作成 Modal を開く', async () => {
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[]} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'JSON から作成' }))

    const dialog = await screen.findByRole('dialog', { name: 'JSON からテンプレートを作成' })
    expect(within(dialog).getByRole('textbox', { name: 'テンプレート JSON' })).toBeTruthy()
  })

  it('JSON から作成 Modal に生成用プロンプトのコピーボタンを表示する', async () => {
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[]} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'JSON から作成' }))

    const dialog = await screen.findByRole('dialog', { name: 'JSON からテンプレートを作成' })
    expect(within(dialog).getByRole('button', { name: '生成用プロンプトをコピー' })).toBeTruthy()
    expect(within(dialog).getByText(/JSON の生成を依頼できます/)).toBeTruthy()
  })

  it('生成用プロンプト全文を clipboard に 1 回書き込む', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
    try {
      render(
        <MantineProvider>
          <TemplateListV3 summaries={[]} />
        </MantineProvider>
      )

      fireEvent.click(screen.getByRole('button', { name: 'JSON から作成' }))
      const dialog = await screen.findByRole('dialog', { name: 'JSON からテンプレートを作成' })
      await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name: '生成用プロンプトをコピー' }))
      })

      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
      expect(writeText).toHaveBeenCalledWith(TEMPLATE_GENERATION_PROMPT)
      expect(within(dialog).queryByText('JSON として読み取れません')).toBeNull()
      expect(mockedImportTemplate).not.toHaveBeenCalled()
      await within(dialog).findByRole('button', { name: 'コピーしました' })
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('生成用プロンプトに必須セクションを含む', () => {
    expect(TEMPLATE_GENERATION_PROMPT).toContain('\n# 作るもの\n')
    expect(TEMPLATE_GENERATION_PROMPT).toContain('# 部品カタログ')
    expect(TEMPLATE_GENERATION_PROMPT).toContain('# 完全な出力例')
    expect(TEMPLATE_GENERATION_PROMPT.length).toBeGreaterThan(6000)
  })

  it('不正 JSON では importTemplate を呼ばず Modal 内にエラーを表示する', async () => {
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[]} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'JSON から作成' }))
    const dialog = await screen.findByRole('dialog', { name: 'JSON からテンプレートを作成' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'テンプレート JSON' }), {
      target: { value: '{"name":' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '作成' }))

    expect(await within(dialog).findByText('JSON として読み取れません')).toBeTruthy()
    expect(mockedImportTemplate).not.toHaveBeenCalled()
  })

  it('正常 JSON では parse 済み payload で importTemplate を 1 回呼ぶ', async () => {
    mockedImportTemplate.mockResolvedValue({ error: null })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[]} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'JSON から作成' }))
    const dialog = await screen.findByRole('dialog', { name: 'JSON からテンプレートを作成' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'テンプレート JSON' }), {
      target: { value: '{"name":"JSON テンプレート","sections":[]}' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '作成' }))

    await waitFor(() =>
      expect(mockedImportTemplate).toHaveBeenCalledWith({ name: 'JSON テンプレート', sections: [] })
    )
    expect(mockedImportTemplate).toHaveBeenCalledTimes(1)
  })

  it('JSON 作成ボタンを連打しても importTemplate は 1 回だけ呼ばれる', async () => {
    mockedImportTemplate.mockResolvedValue({ error: null })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[]} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'JSON から作成' }))
    const dialog = await screen.findByRole('dialog', { name: 'JSON からテンプレートを作成' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'テンプレート JSON' }), {
      target: { value: '{"name":"JSON テンプレート"}' }
    })
    const createButton = within(dialog).getByRole('button', { name: '作成' })
    fireEvent.click(createButton)
    await act(async () => {
      fireEvent.click(createButton)
    })

    expect(mockedImportTemplate).toHaveBeenCalledTimes(1)
  })

  it('system 所有の published カードは配布 Badge・作成・複製操作を表示し、編集・削除を表示しない', () => {
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[systemPublishedSummary]} />
      </MantineProvider>
    )

    expect(screen.getByText('配布')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'このテンプレートで作成' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '複製して編集' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: '編集' })).toBeNull()
    expect(screen.queryByRole('button', { name: '削除' })).toBeNull()
  })

  it('自分所有のカードは編集・複製・削除操作を表示し、配布 Badge を表示しない', () => {
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary]} />
      </MantineProvider>
    )

    expect(screen.getByRole('link', { name: '編集' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '複製して編集' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '削除' })).toBeTruthy()
    expect(screen.queryByText('配布')).toBeNull()
  })

  it('複製ボタン押下で該当 templateId の forkTemplate を呼ぶ', async () => {
    mockedForkTemplate.mockResolvedValue({ error: null })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary]} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: '複製して編集' }))

    await waitFor(() => expect(mockedForkTemplate).toHaveBeenCalledWith(publishedSummary.templateId))
  })

  it('複製ボタンを連打しても forkTemplate は 1 回だけ呼ばれる', async () => {
    mockedForkTemplate.mockResolvedValue({ error: null })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary]} />
      </MantineProvider>
    )

    const forkButton = screen.getByRole('button', { name: '複製して編集' })
    fireEvent.click(forkButton)
    await act(async () => {
      fireEvent.click(forkButton)
    })

    expect(mockedForkTemplate).toHaveBeenCalledTimes(1)
  })

  it('削除ボタンを連打しても deleteTemplate は 1 回だけ呼ばれる', async () => {
    mockedDeleteTemplate.mockResolvedValue({ error: null })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary]} />
      </MantineProvider>
    )

    const deleteButton = screen.getByRole('button', { name: '削除' })
    fireEvent.click(deleteButton)
    await act(async () => {
      fireEvent.click(deleteButton)
    })

    expect(mockedDeleteTemplate).toHaveBeenCalledTimes(1)
  })

  it('v2 移行ボタンを連打しても importTemplate は 1 回だけ呼ばれる', async () => {
    mockedImportTemplate.mockResolvedValue({ error: null })
    localStorage.setItem(
      'ct.templates.v2',
      JSON.stringify([
        {
          id: 'legacy-template-1',
          name: '旧テンプレート',
          version: '1.0.0',
          schemaVersion: 2,
          fields: []
        }
      ])
    )

    try {
      render(
        <MantineProvider>
          <TemplateListV3 summaries={[]} />
        </MantineProvider>
      )

      const migrateButton = await screen.findByRole('button', { name: 'v3 draft として作成' })
      fireEvent.click(migrateButton)
      await act(async () => {
        fireEvent.click(migrateButton)
      })

      expect(mockedImportTemplate).toHaveBeenCalledTimes(1)
    } finally {
      localStorage.removeItem('ct.templates.v2')
    }
  })

  it('system 所有のカードから作成 Modal を開いてキャラクターを作成できる', async () => {
    mockedCreateCharacter.mockResolvedValue({ error: null, rollOnCreateResults })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[systemPublishedSummary]} />
      </MantineProvider>
    )

    await submitCharacterCreation()

    expect(mockedCreateCharacter).toHaveBeenCalledWith({
      templateId: systemPublishedSummary.templateId,
      templateVersion: systemPublishedSummary.version,
      characterName: '探索者'
    })
    expect(await screen.findByText('作成時の出目')).toBeTruthy()
  })

  it('キャラクター作成ボタンを連打しても createCharacter は 1 回だけ呼ばれる', async () => {
    mockedCreateCharacter.mockResolvedValue({ error: null, rollOnCreateResults })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary]} />
      </MantineProvider>
    )

    await openCharacterCreation()
    fireEvent.change(screen.getByRole('textbox', { name: 'キャラクター名' }), {
      target: { value: '探索者' }
    })
    const createButton = screen.getByRole('button', { name: '作成' })
    fireEvent.click(createButton)
    await act(async () => {
      fireEvent.click(createButton)
    })

    expect(mockedCreateCharacter).toHaveBeenCalledTimes(1)
  })

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

    expect(await screen.findAllByText(GENERIC_NETWORK_ERROR_MESSAGE)).toHaveLength(1)
    expect(screen.queryByText('テンプレート一覧の処理に失敗しました')).toBeNull()
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
      expect(screen.queryByText(String(result.total), { exact: false })).toBeNull()
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
