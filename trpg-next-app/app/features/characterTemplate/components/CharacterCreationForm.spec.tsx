/** @jest-environment jsdom */

jest.mock('../actions', () => ({
  createCharacter: jest.fn()
}))

jest.mock('../../characterSheet/TemplateFormRenderer.module.css', () => ({
  __esModule: true,
  default: {
    fieldContainer: 'fieldContainer',
    gridField: 'gridField',
    tableScroll: 'tableScroll'
  }
}))

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createCharacter } from '../actions'
import type { CharacterSheetTemplateEntity } from '../types/v3'
import { CharacterCreationForm } from './CharacterCreationForm'

const mockedCreateCharacter = jest.mocked(createCharacter)

const template: CharacterSheetTemplateEntity = {
  templateId: 'template-1',
  status: 'published',
  version: '1.0.0',
  schemaVersion: 3,
  name: '探索者テンプレート',
  gameSystemId: 'Cthulhu7th',
  tags: [],
  visibility: 'public',
  authorDiscordUserId: 'author-1',
  sections: [
    {
      id: 'basic',
      label: '基本情報',
      fields: [
        {
          id: 'occupation',
          uid: 'uid-occupation',
          type: 'scalar',
          label: '職業',
          valueType: 'text'
        },
        {
          id: 'str',
          uid: 'uid-str',
          type: 'scalar',
          label: 'STR',
          valueType: 'number',
          rollOnCreate: { notation: '3d6*5' }
        }
      ]
    }
  ],
  tables: [],
  settings: { rounding: 'floor' },
  draftRevision: 1
}

function renderForm() {
  return render(
    <MantineProvider>
      <CharacterCreationForm template={template} />
    </MantineProvider>
  )
}

async function enterRequiredValues() {
  fireEvent.change(screen.getByRole('textbox', { name: 'キャラクター名' }), {
    target: { value: ' 探索者 ' }
  })
  fireEvent.change(screen.getByRole('textbox', { name: '職業' }), {
    target: { value: '探偵' }
  })
}

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
})

describe('CharacterCreationForm', () => {
  it('テンプレートの入力値をキャラクター作成 action へ渡す', async () => {
    mockedCreateCharacter.mockResolvedValue({ error: null, rollOnCreateResults: [] })
    renderForm()
    await enterRequiredValues()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'キャラクターを作成' }))
    })

    expect(mockedCreateCharacter).toHaveBeenCalledWith({
      templateId: 'template-1',
      templateVersion: '1.0.0',
      characterName: ' 探索者 ',
      values: { 'uid-occupation': '探偵' }
    })
    expect(await screen.findByText('作成が完了しました。')).toBeTruthy()
  })

  it('作成時ロール項目を案内し、その項目の明示値は作成値へ入れない', async () => {
    mockedCreateCharacter.mockResolvedValue({ error: null, rollOnCreateResults: [] })
    renderForm()
    await enterRequiredValues()

    fireEvent.change(screen.getByRole('textbox', { name: 'STR' }), { target: { value: '60' } })
    expect(screen.getByText('作成時ロールが設定された項目はサーバー側で決定され、この画面では変更できません。')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'キャラクターを作成' }))
    })

    expect(mockedCreateCharacter).toHaveBeenCalledWith(expect.objectContaining({
      values: { 'uid-occupation': '探偵' }
    }))
  })

  it('作成時ロールの結果を表示する', async () => {
    mockedCreateCharacter.mockResolvedValue({
      error: null,
      rollOnCreateResults: [
        {
          uid: 'uid-str',
          label: 'STR',
          notation: '3d6*5',
          total: 55,
          details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55'
        }
      ]
    })
    renderForm()
    await enterRequiredValues()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'キャラクターを作成' }))
    })

    expect(await screen.findByText('作成時の出目')).toBeTruthy()
    expect(screen.getByText('STR: (3D6*5) ＞ 11[2,4,5]*5 ＞ 55')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'キャラクター一覧へ' }).getAttribute('href')).toBe('/user/character')
  })

  it('作成 action のエラーを入力値を保ったまま表示する', async () => {
    mockedCreateCharacter.mockResolvedValue({ error: '作成に失敗しました' })
    renderForm()
    await enterRequiredValues()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'キャラクターを作成' }))
    })

    expect(await screen.findByText('作成に失敗しました')).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'キャラクター名' }) as HTMLInputElement).value).toBe(' 探索者 ')
    expect((screen.getByRole('textbox', { name: '職業' }) as HTMLInputElement).value).toBe('探偵')
  })

  it('送信中の連打でも createCharacter は 1 回だけ呼ぶ', async () => {
    let resolve!: (value: { error: string | null; rollOnCreateResults?: [] }) => void
    mockedCreateCharacter.mockReturnValue(new Promise((resolvePromise) => {
      resolve = resolvePromise
    }))
    renderForm()
    await enterRequiredValues()
    const submitButton = screen.getByRole('button', { name: 'キャラクターを作成' })

    fireEvent.click(submitButton)
    fireEvent.click(submitButton)

    expect(mockedCreateCharacter).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ error: null, rollOnCreateResults: [] }))
    await waitFor(() => expect(screen.getByText('作成が完了しました。')).toBeTruthy())
  })
})
