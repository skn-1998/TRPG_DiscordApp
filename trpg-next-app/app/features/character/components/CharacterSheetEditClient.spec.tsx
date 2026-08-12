/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { CharacterWire } from '@trpg/api-contract'
import type { CharacterSheetTemplateEntity } from '../../characterTemplate/types/v3'
import { saveSheet } from '../actions'
import { CharacterSheetEditClient } from './CharacterSheetEditClient'

jest.mock('../actions', () => ({ saveSheet: jest.fn() }))

const mockedSaveSheet = jest.mocked(saveSheet)
const character: CharacterWire = {
  characterId: 'character-1',
  characterName: '探索者',
  gameSystemId: 'coc',
  discordUserId: 'user-1',
  sheet: {
    templateId: 'template-1',
    templateVersion: '1.0.0',
    revision: 1,
    values: { 'main.hp': 10, 'main.name': '初期名' }
  }
}
const template: CharacterSheetTemplateEntity = {
  templateId: 'template-1',
  name: '探索者テンプレート',
  version: '1.0.0',
  schemaVersion: 3,
  tags: [],
  visibility: 'private',
  authorDiscordUserId: 'user-1',
  status: 'published',
  draftRevision: 1,
  sections: [{
    id: 'main',
    label: 'メイン',
    fields: [
      { id: 'hp', uid: 'main.hp', label: 'HP', type: 'scalar', valueType: 'number' },
      { id: 'name', uid: 'main.name', label: '名前', type: 'scalar', valueType: 'text' }
    ]
  }],
  tables: [],
  settings: { rounding: 'round' }
}

function mergeConflict(fieldUid = 'main.hp', current: unknown = 8, currentRevision = 4) {
  return {
    error: '他の操作と同じ項目が更新されました。競合内容を確認してください。',
    conflict: true,
    mergeConflict: {
      characterId: 'character-1',
      conflicts: [{ path: { fieldUid }, current, base: 10, yours: 9 }],
      currentRevision
    }
  }
}

function renderEditor() {
  return render(
    <MantineProvider>
      <CharacterSheetEditClient character={character} template={template} />
    </MantineProvider>
  )
}

async function submitHpChange(result = mergeConflict()) {
  mockedSaveSheet.mockResolvedValueOnce(result)
  fireEvent.change(screen.getByRole('textbox', { name: /^HP/ }), { target: { value: '9' } })
  fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
  return screen.findByRole('region', { name: '保存競合' })
}

beforeEach(() => mockedSaveSheet.mockReset())
afterEach(cleanup)

describe('CharacterSheetEditClient', () => {
  it('mergeConflict は汎用 Alert ではなく非モーダルの競合パネルへ表示する', async () => {
    renderEditor()
    await submitHpChange()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('相手の値: 8')).toBeTruthy()
    expect(screen.getByText('自分の値: 9')).toBeTruthy()
    expect((screen.getByRole('button', { name: '選択を適用' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('theirs は current を表示値と baseline に採用し、その path を再送から除く', async () => {
    renderEditor()
    await submitHpChange()
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '変更名' } })
    fireEvent.click(screen.getByRole('radio', { name: '相手の値を採用 (theirs)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(2))
    expect((screen.getByRole('textbox', { name: /^HP/ }) as HTMLInputElement).value).toBe('8')
    expect(mockedSaveSheet.mock.calls[1]?.[1]).toEqual({
      baseRevision: 4,
      changes: [{ path: { fieldUid: 'main.name' }, baseValue: '初期名', newValue: '変更名' }]
    })
  })

  it('theirs の適用後に別 field を保存すると更新済みの baseRevision を使う', async () => {
    renderEditor()
    await submitHpChange()
    fireEvent.click(screen.getByRole('radio', { name: '相手の値を採用 (theirs)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    expect(mockedSaveSheet).toHaveBeenCalledTimes(1)

    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '変更名' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(2))
    expect(mockedSaveSheet.mock.calls[1]?.[1]).toEqual({
      baseRevision: 4,
      changes: [{ path: { fieldUid: 'main.name' }, baseValue: '初期名', newValue: '変更名' }]
    })
  })

  it('mine は currentRevision と current を新しい base にして自分の値を再送する', async () => {
    renderEditor()
    await submitHpChange()
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.click(screen.getByRole('radio', { name: '自分の値を採用 (mine)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(2))
    expect(mockedSaveSheet.mock.calls[1]?.[1]).toEqual({
      baseRevision: 4,
      changes: [{ path: { fieldUid: 'main.hp' }, baseValue: 8, newValue: 9 }]
    })
  })

  it('mine の再送が再び 409 なら最新 payload でパネルと選択状態を置き換える', async () => {
    renderEditor()
    await submitHpChange()
    mockedSaveSheet.mockResolvedValueOnce(mergeConflict('main.hp', 7, 5))
    fireEvent.click(screen.getByRole('radio', { name: '自分の値を採用 (mine)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    expect(await screen.findByText('相手の値: 7')).toBeTruthy()
    expect(screen.queryByText('相手の値: 8')).toBeNull()
    expect((screen.getByRole('radio', { name: '自分の値を採用 (mine)' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('button', { name: '選択を適用' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('競合パネル表示中も他 field を編集できる', async () => {
    renderEditor()
    await submitHpChange()
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '編集中' } })

    expect((screen.getByLabelText('名前') as HTMLInputElement).value).toBe('編集中')
    expect(screen.getByRole('region', { name: '保存競合' })).toBeTruthy()
  })

  it('競合パネル表示中の手動保存が再び 409 なら最新 payload でパネルを置き換える', async () => {
    renderEditor()
    await submitHpChange()
    mockedSaveSheet.mockResolvedValueOnce(mergeConflict('main.hp', 7, 5))
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '編集中' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(await screen.findByText('相手の値: 7')).toBeTruthy()
    expect(screen.queryByText('相手の値: 8')).toBeNull()
    expect((screen.getByRole('radio', { name: '相手の値を採用 (theirs)' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('radio', { name: '自分の値を採用 (mine)' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('button', { name: '選択を適用' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('競合パネル表示中の手動保存が非競合エラーならパネルを残して Alert を併記する', async () => {
    renderEditor()
    await submitHpChange()
    mockedSaveSheet.mockResolvedValueOnce({ error: '入力値が不正です' })
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '編集中' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect((await screen.findByRole('alert')).textContent).toContain('入力値が不正です')
    expect(screen.getByRole('region', { name: '保存競合' })).toBeTruthy()
    expect(screen.getByText('相手の値: 8')).toBeTruthy()
  })

  it('current の型が field.valueType と異なる場合は未入力として採用する', async () => {
    renderEditor()
    await submitHpChange(mergeConflict('main.hp', '8'))
    expect(screen.getByText('相手の値: 未入力')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: '相手の値を採用 (theirs)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    expect((screen.getByRole('textbox', { name: /^HP/ }) as HTMLInputElement).value).toBe('')
    expect(mockedSaveSheet).toHaveBeenCalledTimes(1)
  })

  it('全 conflict が編集対象外ならパネルを出さず現行の汎用競合へ fail-back する', async () => {
    renderEditor()
    mockedSaveSheet.mockResolvedValueOnce(mergeConflict('unknown.field'))
    fireEvent.change(screen.getByRole('textbox', { name: /^HP/ }), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。'
    )
    expect(screen.queryByRole('region', { name: '保存競合' })).toBeNull()
  })
})
