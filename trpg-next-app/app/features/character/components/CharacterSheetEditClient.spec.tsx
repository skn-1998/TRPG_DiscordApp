/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { CharacterWire } from '@trpg/api-contract'
import { Component, type ReactNode } from 'react'
import type { CharacterSheetTemplateEntity } from '../../characterTemplate/types/v3'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { saveSheet } from '../actions'
import { GENERIC_SHEET_CONFLICT_MESSAGE } from '../sheet-edit'
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
    visibility: 'private',
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

function deferredSaveResult() {
  type SaveResult = Awaited<ReturnType<typeof saveSheet>>
  let resolve!: (result: SaveResult) => void
  const promise = new Promise<SaveResult>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

class RedirectErrorBoundary extends Component<{
  children: ReactNode
  onError: (error: Error) => void
}, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    return this.state.hasError ? <div>redirect handled</div> : this.props.children
  }
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
  it('初期状態と保存成功時は未保存バナーを表示しない', async () => {
    renderEditor()
    expect(screen.queryByText('保存されていません')).toBeNull()

    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(screen.getByRole('textbox', { name: /^HP/ }), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('保存されていません')).toBeNull()
  })

  it('保存失敗後は dirty と入力値を保持して未保存バナーを常掲する', async () => {
    renderEditor()
    mockedSaveSheet.mockResolvedValueOnce({ error: '保存に失敗しました', retryable: true })
    const hpInput = screen.getByRole('textbox', { name: /^HP/ }) as HTMLInputElement
    fireEvent.change(hpInput, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(await screen.findByText('保存されていません')).toBeTruthy()
    expect(hpInput.value).toBe('9')
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '編集中' } })
    expect(screen.getByText('保存されていません')).toBeTruthy()
  })

  it('saveSheet の reject 後も dirty を保持して通信失敗と再試行を表示する', async () => {
    renderEditor()
    mockedSaveSheet.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const hpInput = screen.getByRole('textbox', { name: /^HP/ }) as HTMLInputElement
    fireEvent.change(hpInput, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(screen.getByText(GENERIC_NETWORK_ERROR_MESSAGE)).toBeTruthy()
    expect(hpInput.value).toBe('9')
    const retryButton = screen.getByRole('button', { name: '再試行' }) as HTMLButtonElement
    await waitFor(() => expect(retryButton.disabled).toBe(false))
  })

  it('成功時の redirect reject は透過し、通信失敗 Alert を表示しない', async () => {
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;push;/user/character;307;'
    })
    const onError = jest.fn()
    mockedSaveSheet.mockRejectedValueOnce(redirectError)
    render(
      <RedirectErrorBoundary onError={onError}>
        <MantineProvider>
          <CharacterSheetEditClient character={character} template={template} />
        </MantineProvider>
      </RedirectErrorBoundary>,
      { onCaughtError: () => undefined }
    )
    fireEvent.change(screen.getByRole('textbox', { name: /^HP/ }), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith(redirectError))
    expect(screen.queryByText(GENERIC_NETWORK_ERROR_MESSAGE)).toBeNull()
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('失敗後に値を baseline へ戻すと未保存バナーが消える', async () => {
    renderEditor()
    mockedSaveSheet.mockResolvedValueOnce({ error: '保存に失敗しました', retryable: true })
    const hpInput = screen.getByRole('textbox', { name: /^HP/ })
    fireEvent.change(hpInput, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    await screen.findByText('保存されていません')

    fireEvent.change(hpInput, { target: { value: '10' } })

    expect(screen.queryByText('保存されていません')).toBeNull()
  })

  it('失敗後に changes が空になると再試行ボタンを disabled にする', async () => {
    renderEditor()
    mockedSaveSheet.mockResolvedValueOnce({ error: '保存に失敗しました', retryable: true })
    const hpInput = screen.getByRole('textbox', { name: /^HP/ })
    fireEvent.change(hpInput, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    const retryButton = await screen.findByRole('button', { name: '再試行' }) as HTMLButtonElement
    await waitFor(() => expect(retryButton.disabled).toBe(false))

    fireEvent.change(hpInput, { target: { value: '10' } })

    expect(retryButton.disabled).toBe(true)
  })

  it('手動再試行はクリック時点の最新 dirty を送る', async () => {
    renderEditor()
    mockedSaveSheet.mockResolvedValueOnce({ error: '保存に失敗しました', retryable: true })
    const hpInput = screen.getByRole('textbox', { name: /^HP/ })
    fireEvent.change(hpInput, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    await screen.findByRole('button', { name: '再試行' })

    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(hpInput, { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(2))
    expect(mockedSaveSheet.mock.calls[1]?.[1]).toEqual({
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.hp' }, baseValue: 10, newValue: 7 }]
    })
  })

  it('422 の恒久エラーには再試行ボタンを表示しない', async () => {
    renderEditor()
    mockedSaveSheet.mockResolvedValueOnce({ error: '入力値が不正です', retryable: false })
    fireEvent.change(screen.getByRole('textbox', { name: /^HP/ }), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(await screen.findByText('入力値が不正です')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '再試行' })).toBeNull()
  })

  it('保存送信中の submit は重複送信しない', async () => {
    renderEditor()
    const pending = deferredSaveResult()
    mockedSaveSheet.mockReturnValueOnce(pending.promise)
    fireEvent.change(screen.getByRole('textbox', { name: /^HP/ }), { target: { value: '9' } })
    const saveButton = screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement
    const form = saveButton.closest('form')
    if (!form) throw new Error('保存フォームが見つかりません')
    fireEvent.click(saveButton)

    await waitFor(() => expect(saveButton.disabled).toBe(true))
    fireEvent.submit(form)
    expect(mockedSaveSheet).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({ error: '保存に失敗しました', retryable: true })
      await pending.promise
    })
  })

  it('再試行送信中は再試行操作が disabled になる', async () => {
    renderEditor()
    mockedSaveSheet.mockResolvedValueOnce({ error: '保存に失敗しました', retryable: true })
    fireEvent.change(screen.getByRole('textbox', { name: /^HP/ }), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    const retryButton = await screen.findByRole('button', { name: '再試行' }) as HTMLButtonElement
    await waitFor(() => expect(retryButton.disabled).toBe(false))
    const pending = deferredSaveResult()
    mockedSaveSheet.mockReturnValueOnce(pending.promise)
    fireEvent.click(retryButton)

    await waitFor(() => expect(retryButton.disabled).toBe(true))
    fireEvent.click(retryButton)
    expect(mockedSaveSheet).toHaveBeenCalledTimes(2)

    await act(async () => {
      pending.resolve({ error: '保存に失敗しました', retryable: true })
      await pending.promise
    })
  })

  it('保存送信中は競合適用操作が disabled になる', async () => {
    renderEditor()
    await submitHpChange()
    fireEvent.click(screen.getByRole('radio', { name: '自分の値を採用 (mine)' }))
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '編集中' } })
    const pending = deferredSaveResult()
    mockedSaveSheet.mockReturnValueOnce(pending.promise)
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    const applyButton = screen.getByRole('button', { name: '選択を適用' }) as HTMLButtonElement

    await waitFor(() => expect(applyButton.disabled).toBe(true))
    fireEvent.click(applyButton)
    expect(mockedSaveSheet).toHaveBeenCalledTimes(2)

    await act(async () => {
      pending.resolve({ error: '保存に失敗しました', retryable: true })
      await pending.promise
    })
  })

  it('mergeConflict は汎用 Alert ではなく非モーダルの競合パネルへ表示する', async () => {
    renderEditor()
    await submitHpChange()

    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.textContent).toContain('保存されていません')
    expect(alerts[0]?.textContent).not.toContain('他の操作でシートが更新されました。')
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

  it('競合パネル表示中の保存は競合 path を payload から除外し、成功後もパネルを残す', async () => {
    renderEditor()
    await submitHpChange()
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '変更名' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(2))
    expect(mockedSaveSheet.mock.calls[1]?.[1]).toEqual({
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.name' }, baseValue: '初期名', newValue: '変更名' }]
    })
    expect(screen.getByRole('region', { name: '保存競合' })).toBeTruthy()
    expect(screen.getByText('相手の値: 8')).toBeTruthy()
  })

  it('競合 path しか dirty でない間は空の changes を送信しない', async () => {
    renderEditor()
    await submitHpChange()

    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(mockedSaveSheet).toHaveBeenCalledTimes(1)
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

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((alert) => alert.textContent?.includes('入力値が不正です'))).toBe(true)
    expect(screen.getByRole('region', { name: '保存競合' })).toBeTruthy()
    expect(screen.getByText('相手の値: 8')).toBeTruthy()
  })

  it('競合パネル表示中の retryable 失敗はパネル・再試行つき赤 Alert・橙バナーを併記する', async () => {
    renderEditor()
    await submitHpChange()
    mockedSaveSheet.mockResolvedValueOnce({ error: '一時的に保存できません', retryable: true })
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '編集中' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    const alerts = screen.getAllByRole('alert')
    expect(alerts.some((alert) => alert.textContent?.includes('保存できませんでした'))).toBe(true)
    expect(alerts.some((alert) => alert.textContent?.includes('保存されていません'))).toBe(true)
    expect(screen.getByRole('button', { name: '再試行' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '保存競合' })).toBeTruthy()
  })

  it('action 側 fail-back は旧パネルと選択を破棄して汎用競合 Alert に統一する', async () => {
    renderEditor()
    await submitHpChange()
    fireEvent.click(screen.getByRole('radio', { name: '自分の値を採用 (mine)' }))
    mockedSaveSheet.mockResolvedValueOnce({ error: GENERIC_SHEET_CONFLICT_MESSAGE, conflict: true })
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '編集中' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(await screen.findByText(GENERIC_SHEET_CONFLICT_MESSAGE)).toBeTruthy()
    expect(screen.queryByRole('region', { name: '保存競合' })).toBeNull()
    expect(screen.queryByRole('radio', { name: '自分の値を採用 (mine)' })).toBeNull()
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

  it('client 側 fail-back は旧パネルと選択を破棄して汎用競合 Alert に統一する', async () => {
    renderEditor()
    await submitHpChange()
    fireEvent.click(screen.getByRole('radio', { name: '自分の値を採用 (mine)' }))
    mockedSaveSheet.mockResolvedValueOnce(mergeConflict('unknown.field'))
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '編集中' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts.some((alert) => alert.textContent?.includes(GENERIC_SHEET_CONFLICT_MESSAGE))).toBe(true)
    expect(screen.queryByRole('region', { name: '保存競合' })).toBeNull()
    expect(screen.queryByRole('radio', { name: '自分の値を採用 (mine)' })).toBeNull()
  })
})
