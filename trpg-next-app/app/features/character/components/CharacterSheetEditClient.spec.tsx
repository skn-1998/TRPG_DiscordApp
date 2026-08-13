/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CharacterWire } from '@trpg/api-contract'
import { Component, type ReactNode } from 'react'
import type { CharacterSheetTemplateEntity, SheetField } from '../../characterTemplate/types/v3'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { saveSheet } from '../actions'
import { GENERIC_SHEET_CONFLICT_MESSAGE } from '../sheet-edit'
import { CharacterSheetEditClient } from './CharacterSheetEditClient'

jest.mock('../actions', () => ({ saveSheet: jest.fn() }))
// この spec は編集境界の配線を検証するため、視覚スタイルではなく TFR の実描画と callback 契約を jsdom へ通す。
jest.mock('../../characterSheet/TemplateFormRenderer.module.css', () => ({
  __esModule: true,
  default: {
    fieldContainer: 'fieldContainer',
    gridField: 'gridField',
    tableScroll: 'tableScroll'
  }
}))

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
const booleanTemplate: CharacterSheetTemplateEntity = {
  ...template,
  sections: [{
    ...template.sections[0]!,
    fields: [
      ...template.sections[0]!.fields,
      { id: 'alive', uid: 'main.alive', label: '生存', type: 'scalar', valueType: 'boolean' }
    ]
  }]
}
const booleanCharacter: CharacterWire = {
  ...character,
  sheet: {
    ...character.sheet!,
    values: { ...character.sheet!.values, 'main.alive': true }
  }
}
const selectTemplate: CharacterSheetTemplateEntity = {
  ...template,
  sections: [{
    ...template.sections[0]!,
    fields: [
      ...template.sections[0]!.fields,
      {
        id: 'job',
        uid: 'main.job',
        label: '職業',
        type: 'scalar',
        valueType: 'select',
        options: [
          { label: '探偵', value: 'detective' },
          { label: '医師', value: 'doctor' },
          { label: '記者', value: 'journalist' }
        ]
      }
    ]
  }]
}
const selectCharacter: CharacterWire = {
  ...character,
  sheet: {
    ...character.sheet!,
    values: { ...character.sheet!.values, 'main.job': 'detective' }
  }
}
const editorContractDriftTemplate: CharacterSheetTemplateEntity = {
  ...template,
  sections: [{
    ...template.sections[0]!,
    fields: [
      ...template.sections[0]!.fields,
      {
        id: 'active',
        uid: 'main.active',
        label: '有効',
        type: 'scalar',
        valueType: 'checkbox'
      } as unknown as SheetField
    ]
  }]
}
const declaredPartsCharacter: CharacterWire = {
  ...character,
  sheet: {
    ...character.sheet!,
    values: { ...character.sheet!.values, 'main.hp': { parts: { base: 10, growth: 5 } } }
  }
}
const declaredPartsTemplate: CharacterSheetTemplateEntity = {
  ...template,
  sections: [{
    id: 'main',
    label: 'メイン',
    layout: { preset: 'stack' },
    fields: [
      {
        id: 'hp',
        uid: 'main.hp',
        label: 'HP',
        type: 'scalar',
        valueType: 'number',
        partsKeys: [{ id: 'growth', label: '成長分' }]
      },
      { id: 'name', uid: 'main.name', label: '名前', type: 'scalar', valueType: 'text' }
    ]
  }]
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

function mergeGrowthConflict(current: unknown, currentRevision = 4) {
  return {
    error: '他の操作と同じ項目が更新されました。競合内容を確認してください。',
    conflict: true,
    mergeConflict: {
      characterId: 'character-1',
      conflicts: [{
        path: { fieldUid: 'main.hp', partsKey: 'growth' },
        current,
        base: 5,
        yours: 6
      }],
      currentRevision
    }
  }
}

function mergePartsConflicts(currentRevision = 4) {
  return {
    error: '他の操作と同じ項目が更新されました。競合内容を確認してください。',
    conflict: true,
    mergeConflict: {
      characterId: 'character-1',
      conflicts: [
        { path: { fieldUid: 'main.hp', partsKey: 'base' }, current: 12, base: 10, yours: 10 },
        { path: { fieldUid: 'main.hp', partsKey: 'growth' }, current: 7, base: 5, yours: 6 }
      ],
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

  it('parts field の raw shape を保ち、popover の base 編集を partsKey つき change として保存する', async () => {
    const partsCharacter: CharacterWire = {
      ...character,
      sheet: {
        ...character.sheet!,
        values: { ...character.sheet!.values, 'main.hp': { parts: { base: 10, custom: 2 } } }
      }
    }
    const partsTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [{
        id: 'main',
        label: 'メイン',
        fields: [
          { id: 'hp', uid: 'main.hp', label: 'HP', type: 'scalar', valueType: 'number', parts: true },
          { id: 'name', uid: 'main.name', label: '名前', type: 'scalar', valueType: 'text' }
        ]
      }]
    }
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={partsCharacter} template={partsTemplate} />
      </MantineProvider>
    )
    const partsTrigger = screen.getByRole('button', { name: 'HP: 内訳を編集' })
    expect(partsTrigger.textContent).toBe('12')
    fireEvent.click(partsTrigger)
    const baseInput = await screen.findByRole('textbox', { name: 'HP: base' }) as HTMLInputElement

    // base だけを編集 state で上書きしても、既存 parts が合計表示から失われないことを固定する。
    expect(baseInput.value).toBe('10')
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(baseInput, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(1))
    expect(mockedSaveSheet.mock.calls[0]?.[1]).toEqual({
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.hp', partsKey: 'base' }, baseValue: 10, newValue: 9 }]
    })
  })

  it('宣言 partsKeys field の初期合計と popover 内訳に raw parts を表示する', async () => {
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={declaredPartsCharacter} template={declaredPartsTemplate} />
      </MantineProvider>
    )
    const partsTrigger = screen.getByRole('button', { name: 'HP: 内訳を編集' })

    // EditorValue が未確定でも raw base を失わず、annotation 合計と内訳を同じ初期値から描画することを固定する。
    expect(partsTrigger.textContent).toBe('15')
    fireEvent.click(partsTrigger)
    const baseInput = await screen.findByRole('textbox', { name: 'HP: base' }) as HTMLInputElement
    const popover = document.querySelector('[data-parts-popover="main.hp"]') as HTMLElement
    const growthInput = popover.querySelector('input[aria-label="HP: 成長分"]') as HTMLInputElement
    expect([baseInput.value, growthInput.value]).toEqual(['10', '5'])
  })

  it('宣言 partsKeys field の base 編集を per-path payload で保存する', async () => {
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={declaredPartsCharacter} template={declaredPartsTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'HP: 内訳を編集' }))
    const baseInput = await screen.findByRole('textbox', { name: 'HP: base' }) as HTMLInputElement

    // 裁定済み例外 1: 旧 whole-field write は parts 全消失の H3 経路だった。per-path 化は
    // S5b2 スコープの base 分前倒し・台帳 D-R2 行。
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(baseInput, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledWith('character-1', {
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.hp', partsKey: 'base' }, baseValue: 10, newValue: 9 }]
    }))
  })

  it('parts:true field の base が number でなくても raw parts の合計を表示する', () => {
    const partsCharacter: CharacterWire = {
      ...character,
      sheet: {
        ...character.sheet!,
        values: { ...character.sheet!.values, 'main.hp': { parts: { growth: 3 } } }
      }
    }
    const partsTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [{
        id: 'main',
        label: 'メイン',
        layout: { preset: 'stack' },
        fields: [
          { id: 'hp', uid: 'main.hp', label: 'HP', type: 'scalar', valueType: 'number', parts: true },
          { id: 'name', uid: 'main.name', label: '名前', type: 'scalar', valueType: 'text' }
        ]
      }]
    }
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={partsCharacter} template={partsTemplate} />
      </MantineProvider>
    )

    // base を読めない初期値へ undefined を注入せず、残る有効な raw part を annotation 合計へ渡すことを固定する。
    expect(screen.getByRole('button', { name: 'HP: 内訳を編集' }).textContent).toBe('3')
  })

  it("parts:true field の退化 raw を Σ '0' と表示する", () => {
    const partsCharacter: CharacterWire = {
      ...character,
      sheet: {
        ...character.sheet!,
        values: { ...character.sheet!.values, 'main.hp': {} }
      }
    }
    const partsTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [{
        id: 'main',
        label: 'メイン',
        layout: { preset: 'stack' },
        fields: [
          { id: 'hp', uid: 'main.hp', label: 'HP', type: 'scalar', valueType: 'number', parts: true },
          { id: 'name', uid: 'main.name', label: '名前', type: 'scalar', valueType: 'text' }
        ]
      }]
    }
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={partsCharacter} template={partsTemplate} />
      </MantineProvider>
    )

    // 裁定済み例外 2: annotation は退化 raw を engine 意味論で表示する。preview と同一・
    // 旧 overlay は退化を隠していた。
    expect(screen.getByRole('button', { name: 'HP: 内訳を編集' }).textContent).toBe('0')
  })

  it('宣言 partsKeys field の宣言キー入力を兄弟キーなしの per-path change で保存する', async () => {
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={declaredPartsCharacter} template={declaredPartsTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'HP: 内訳を編集' }))
    await screen.findByRole('textbox', { name: 'HP: base' })
    const popover = document.querySelector('[data-parts-popover="main.hp"]') as HTMLElement
    const growthInput = popover.querySelector('input[aria-label="HP: 成長分"]') as HTMLInputElement
    const saveButton = screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement

    // H3 の検出器: growth だけを per-path 化し、base などの兄弟値を payload に混ぜない。
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(growthInput, { target: { value: '6' } })
    fireEvent.click(saveButton)

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledWith('character-1', {
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.hp', partsKey: 'growth' }, baseValue: 5, newValue: 6 }]
    }))
  })

  it('flat number raw の宣言キー編集でも base を表示 state に種付けし、growth だけを保存する', async () => {
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={character} template={declaredPartsTemplate} />
      </MantineProvider>
    )
    const partsTrigger = screen.getByRole('button', { name: 'HP: 内訳を編集' })
    expect(partsTrigger.textContent).toBe('10')
    fireEvent.click(partsTrigger)
    const baseInput = await screen.findByRole('textbox', { name: 'HP: base' }) as HTMLInputElement
    const popover = document.querySelector('[data-parts-popover="main.hp"]') as HTMLElement
    const growthInput = popover.querySelector('input[aria-label="HP: 成長分"]') as HTMLInputElement

    // flat raw の非 base 書込で base を失う変異は、合計 16・base 10・単一 growth path の三面すべてを壊す。
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(growthInput, { target: { value: '6' } })
    expect([partsTrigger.textContent, baseInput.value, growthInput.value]).toEqual(['16', '10', '6'])
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(1))
    expect(mockedSaveSheet.mock.calls[0]?.[1]).toEqual({
      baseRevision: 1,
      changes: [{
        path: { fieldUid: 'main.hp', partsKey: 'growth' },
        baseValue: undefined,
        newValue: 6
      }]
    })
  })

  it('table layout の宣言 partsKeys field は合計セルから base を per-path 保存する', async () => {
    const tableDeclaredPartsTemplate: CharacterSheetTemplateEntity = {
      ...declaredPartsTemplate,
      sections: [{ ...declaredPartsTemplate.sections[0]!, layout: { preset: 'table' } }]
    }
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={declaredPartsCharacter} template={tableDeclaredPartsTemplate} />
      </MantineProvider>
    )

    // Test intent: D-R2 table 宣言モードで失われていた base 編集入口から保存 payload までを一続きで固定する。
    fireEvent.click(screen.getByRole('button', { name: 'HP: 内訳を編集' }))
    const baseInput = await screen.findByRole('textbox', { name: 'HP: base' })
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(baseInput, { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledWith('character-1', {
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.hp', partsKey: 'base' }, baseValue: 10, newValue: 12 }]
    }))
  })

  it('parts:true field の自由キー入力を per-path change で保存する', async () => {
    const partsCharacter: CharacterWire = {
      ...character,
      sheet: {
        ...character.sheet!,
        values: { ...character.sheet!.values, 'main.hp': { parts: { base: 10, custom: 2 } } }
      }
    }
    const partsTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [{
        id: 'main',
        label: 'メイン',
        fields: [
          { id: 'hp', uid: 'main.hp', label: 'HP', type: 'scalar', valueType: 'number', parts: true },
          { id: 'name', uid: 'main.name', label: '名前', type: 'scalar', valueType: 'text' }
        ]
      }]
    }
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={partsCharacter} template={partsTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'HP: 内訳を編集' }))
    const customInput = await screen.findByRole('textbox', { name: 'HP: custom' }) as HTMLInputElement

    // 自由モードも既存 raw の提示可能キーだけを列挙し、whole-field ではなく custom path だけを保存する。
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    fireEvent.change(customInput, { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledWith('character-1', {
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.hp', partsKey: 'custom' }, baseValue: 2, newValue: 3 }]
    }))
  })

  it('parts:true field の未宣言キー競合をキー名 fallback 付きで表示する', async () => {
    const partsCharacter: CharacterWire = {
      ...character,
      sheet: {
        ...character.sheet!,
        values: { ...character.sheet!.values, 'main.hp': { parts: { base: 10, custom: 2 } } }
      }
    }
    const partsTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [{
        id: 'main',
        label: 'メイン',
        fields: [
          { id: 'hp', uid: 'main.hp', label: 'HP', type: 'scalar', valueType: 'number', parts: true },
          { id: 'name', uid: 'main.name', label: '名前', type: 'scalar', valueType: 'text' }
        ]
      }]
    }
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={partsCharacter} template={partsTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'HP: 内訳を編集' }))
    const customInput = await screen.findByRole('textbox', { name: 'HP: custom' })
    mockedSaveSheet.mockResolvedValueOnce({
      error: '他の操作と同じ項目が更新されました。競合内容を確認してください。',
      conflict: true,
      mergeConflict: {
        characterId: 'character-1',
        conflicts: [{
          path: { fieldUid: 'main.hp', partsKey: 'custom' },
          current: 4,
          base: 2,
          yours: 3
        }],
        currentRevision: 4
      }
    })
    fireEvent.change(customInput, { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    // Test intent: 未宣言 partsKey を固定文言へ置換する退行を、見出しと accessible name の両方で検出する。
    expect(await screen.findByText('HP（custom）')).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'HP（custom） の解決方法' })).toBeTruthy()
  })

  it('宣言キー競合を per-path 表示し、theirs で当該キーだけ更新して base を温存する', async () => {
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={declaredPartsCharacter} template={declaredPartsTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'HP: 内訳を編集' }))
    const baseInput = await screen.findByRole('textbox', { name: 'HP: base' }) as HTMLInputElement
    const popover = document.querySelector('[data-parts-popover="main.hp"]') as HTMLElement
    const growthInput = popover.querySelector('input[aria-label="HP: 成長分"]') as HTMLInputElement
    mockedSaveSheet.mockResolvedValueOnce(mergeGrowthConflict(7))
    fireEvent.change(growthInput, { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    // uid 直書きへ退行すると current 7 が field 全体を潰し、base 10 と growth path の両方を失う。
    expect(await screen.findByText('相手の値: 7')).toBeTruthy()
    expect(screen.getByText('自分の値: 6')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: '相手の値を採用 (theirs)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    expect([baseInput.value, growthInput.value]).toEqual(['10', '7'])
    expect(screen.getByRole('button', { name: 'HP: 内訳を編集' }).textContent).toBe('17')
    expect(mockedSaveSheet).toHaveBeenCalledTimes(1)
  })

  it('同一 uid の base/growth 競合を逐次合成し、theirs の両 current を残す', async () => {
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={declaredPartsCharacter} template={declaredPartsTemplate} />
      </MantineProvider>
    )
    const partsTrigger = screen.getByRole('button', { name: 'HP: 内訳を編集' })
    fireEvent.click(partsTrigger)
    const baseInput = await screen.findByRole('textbox', { name: 'HP: base' }) as HTMLInputElement
    const popover = document.querySelector('[data-parts-popover="main.hp"]') as HTMLElement
    const growthInput = popover.querySelector('input[aria-label="HP: 成長分"]') as HTMLInputElement
    mockedSaveSheet.mockResolvedValueOnce(mergePartsConflicts())
    fireEvent.change(growthInput, { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(await screen.findByText('相手の値: 12')).toBeTruthy()
    expect(screen.getByText('相手の値: 7')).toBeTruthy()
    const theirsSelections = screen.getAllByRole('radio', { name: '相手の値を採用 (theirs)' })
    fireEvent.click(theirsSelections[0]!)
    fireEvent.click(theirsSelections[1]!)

    // S5b2 の逐次合成検出器。毎回 baseline/values 起点に戻す非アキュムレート変異では先行 base が消える。
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))
    expect([baseInput.value, growthInput.value]).toEqual(['12', '7'])
    expect(partsTrigger.textContent).toBe('19')
    expect(mockedSaveSheet).toHaveBeenCalledTimes(1)
  })

  it('同一 field の base と宣言キー競合を partsKey 別 radiogroup で独立解決する', async () => {
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={declaredPartsCharacter} template={declaredPartsTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'HP: 内訳を編集' }))
    const baseInput = await screen.findByRole('textbox', { name: 'HP: base' }) as HTMLInputElement
    const popover = document.querySelector('[data-parts-popover="main.hp"]') as HTMLElement
    const growthInput = popover.querySelector('input[aria-label="HP: 成長分"]') as HTMLInputElement
    mockedSaveSheet
      .mockResolvedValueOnce(mergePartsConflicts())
      .mockResolvedValueOnce({ error: null })
    fireEvent.change(growthInput, { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await screen.findByText('HP（基本値）')
    const baseResolution = screen.getByRole('radiogroup', { name: 'HP（基本値） の解決方法' })
    const growthResolution = screen.getByRole('radiogroup', { name: 'HP（成長分） の解決方法' })

    // Test intent: fieldUid だけの conflict id へ退行しても、2 カードの選択状態が共有されないことを固定する。
    fireEvent.click(within(baseResolution).getByRole('radio', { name: '相手の値を採用 (theirs)' }))
    fireEvent.click(within(growthResolution).getByRole('radio', { name: '自分の値を採用 (mine)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(2))
    expect([baseInput.value, growthInput.value]).toEqual(['12', '6'])
    expect(mockedSaveSheet).toHaveBeenNthCalledWith(2, 'character-1', {
      baseRevision: 4,
      changes: [{ path: { fieldUid: 'main.hp', partsKey: 'growth' }, baseValue: 7, newValue: 6 }]
    })
  })

  it('theirs の current:null は宣言キーを削除し、base を温存する', async () => {
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={declaredPartsCharacter} template={declaredPartsTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'HP: 内訳を編集' }))
    const baseInput = await screen.findByRole('textbox', { name: 'HP: base' }) as HTMLInputElement
    const popover = document.querySelector('[data-parts-popover="main.hp"]') as HTMLElement
    const growthInput = popover.querySelector('input[aria-label="HP: 成長分"]') as HTMLInputElement
    mockedSaveSheet.mockResolvedValueOnce(mergeGrowthConflict(null))
    fireEvent.change(growthInput, { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    await screen.findByText('相手の値: 未入力')
    fireEvent.click(screen.getByRole('radio', { name: '相手の値を採用 (theirs)' }))

    // null echo は undefined へ復号され、undefined 値の残留ではなく当該 path の不存在へ戻る。
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))
    expect([baseInput.value, growthInput.value]).toEqual(['10', ''])
    expect(screen.getByRole('button', { name: 'HP: 内訳を編集' }).textContent).toBe('10')
    expect(mockedSaveSheet).toHaveBeenCalledTimes(1)
  })

  it('current:null の mine 再送は baseValue を wire から欠落させて保存成功へ進む', async () => {
    const characterWithoutGrowth: CharacterWire = {
      ...declaredPartsCharacter,
      sheet: {
        ...declaredPartsCharacter.sheet!,
        values: { ...declaredPartsCharacter.sheet!.values, 'main.hp': { parts: { base: 10 } } }
      }
    }
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={characterWithoutGrowth} template={declaredPartsTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'HP: 内訳を編集' }))
    await screen.findByRole('textbox', { name: 'HP: base' })
    const popover = document.querySelector('[data-parts-popover="main.hp"]') as HTMLElement
    const growthInput = popover.querySelector('input[aria-label="HP: 成長分"]') as HTMLInputElement
    mockedSaveSheet
      .mockResolvedValueOnce(mergeGrowthConflict(null))
      .mockResolvedValueOnce({ error: null })
    fireEvent.change(growthInput, { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    await screen.findByText('相手の値: 未入力')
    fireEvent.click(screen.getByRole('radio', { name: '自分の値を採用 (mine)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(2))
    const resentWire = JSON.parse(JSON.stringify(mockedSaveSheet.mock.calls[1]?.[1])) as {
      baseRevision: number
      changes: Array<Record<string, unknown>>
    }
    // null を baseValue に再利用すると不存在期待 CAS にならず再競合する。undefined 復号が JSON 欠落を守る保護線。
    expect(resentWire).toEqual({
      baseRevision: 4,
      changes: [{ path: { fieldUid: 'main.hp', partsKey: 'growth' }, newValue: 6 }]
    })
    expect(Object.prototype.hasOwnProperty.call(resentWire.changes[0], 'baseValue')).toBe(false)
    expect(screen.queryByRole('region', { name: '保存競合' })).toBeNull()
  })

  it('boolean checkbox の checked を per-path change として保存する', async () => {
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={booleanCharacter} template={booleanTemplate} />
      </MantineProvider>
    )
    const checkbox = screen.getByRole('checkbox', { name: '生存' }) as HTMLInputElement
    const saveButton = screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement

    // 旧「編集対象外 uid」境界は TFR が emit する全 scalar の編集対応により UI 到達不能になった。
    // !field guard は TFR 契約 drift 防御として残し、ここでは兄弟を混ぜない boolean payload を固定する。
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)

    expect(checkbox.checked).toBe(false)
    expect(saveButton.disabled).toBe(false)
    fireEvent.click(saveButton)
    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledWith('character-1', {
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.alive' }, baseValue: true, newValue: false }]
    }))
  })

  it('select の選択を旧文字列から新文字列への per-path change として保存する', async () => {
    // options は TFR の到達可能入力だけに使い、payload は選択値の string 型だけを保持する。
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() })
    mockedSaveSheet.mockResolvedValueOnce({ error: null })
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={selectCharacter} template={selectTemplate} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('combobox', { name: '職業' }))
    fireEvent.click(await screen.findByRole('option', { name: '医師' }))
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledWith('character-1', {
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'main.job' }, baseValue: 'detective', newValue: 'doctor' }]
    }))
  })

  it('TFR が emit した編集対象外 valueType は state に取り込まず保存しない', () => {
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={character} template={editorContractDriftTemplate} />
      </MantineProvider>
    )
    const driftInput = screen.getByRole('textbox', { name: '有効' })
    const saveButton = screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement

    // !field ガードは TFR 契約 drift 防御。除去すると usesPartsEditor(undefined) で TypeError になるが、
    // 既存 517 tests では全緑生存していた変異を、この fallback 入力で到達させる。
    fireEvent.change(driftInput, { target: { value: 'enabled' } })

    expect((driftInput as HTMLInputElement).value).toBe('')
    expect(saveButton.disabled).toBe(true)
    fireEvent.click(saveButton)
    expect(mockedSaveSheet).not.toHaveBeenCalled()
  })

  it('boolean current:null の mine 再送は baseValue を own キーごと欠落させて保存成功へ進む', async () => {
    mockedSaveSheet
      .mockResolvedValueOnce(mergeConflict('main.alive', null))
      .mockResolvedValueOnce({ error: null })
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={booleanCharacter} template={booleanTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('checkbox', { name: '生存' }))
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    await screen.findByText('相手の値: 未入力')
    fireEvent.click(screen.getByRole('radio', { name: '自分の値を採用 (mine)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(2))
    const resentWire = JSON.parse(JSON.stringify(mockedSaveSheet.mock.calls[1]?.[1])) as {
      baseRevision: number
      changes: Array<Record<string, unknown>>
    }
    // null echo を undefined へ復号しないと、path 不在を期待する CAS の wire 表現を作れない。
    expect(resentWire).toEqual({
      baseRevision: 4,
      changes: [{ path: { fieldUid: 'main.alive' }, newValue: false }]
    })
    expect(Object.prototype.hasOwnProperty.call(resentWire.changes[0], 'baseValue')).toBe(false)
    expect(screen.queryByRole('region', { name: '保存競合' })).toBeNull()
  })

  it('select current:null の mine 再送は baseValue を own キーごと欠落させて保存成功へ進む', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() })
    mockedSaveSheet
      .mockResolvedValueOnce(mergeConflict('main.job', null))
      .mockResolvedValueOnce({ error: null })
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={selectCharacter} template={selectTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('combobox', { name: '職業' }))
    fireEvent.click(await screen.findByRole('option', { name: '医師' }))
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    await screen.findByText('相手の値: 未入力')
    fireEvent.click(screen.getByRole('radio', { name: '自分の値を採用 (mine)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    await waitFor(() => expect(mockedSaveSheet).toHaveBeenCalledTimes(2))
    const resentWire = JSON.parse(JSON.stringify(mockedSaveSheet.mock.calls[1]?.[1])) as {
      baseRevision: number
      changes: Array<Record<string, unknown>>
    }
    // null echo を undefined へ復号し、path 不在を期待する CAS の wire 表現へ戻す。
    expect(resentWire).toEqual({
      baseRevision: 4,
      changes: [{ path: { fieldUid: 'main.job' }, newValue: 'doctor' }]
    })
    expect(Object.prototype.hasOwnProperty.call(resentWire.changes[0], 'baseValue')).toBe(false)
    expect(screen.queryByRole('region', { name: '保存競合' })).toBeNull()
  })

  it('select 競合の theirs は current 文字列を state と表示へ反映する', async () => {
    // current の string 復号と theirs 適用を一続きで固定し、表示だけ更新して state が旧値に残る退行を防ぐ。
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() })
    mockedSaveSheet.mockResolvedValueOnce(mergeConflict('main.job', 'journalist'))
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={selectCharacter} template={selectTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('combobox', { name: '職業' }))
    fireEvent.click(await screen.findByRole('option', { name: '医師' }))
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(await screen.findByText('相手の値: 記者')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: '相手の値を採用 (theirs)' }))
    fireEvent.click(screen.getByRole('button', { name: '選択を適用' }))

    expect((screen.getByRole('combobox', { name: '職業' }) as HTMLInputElement).value).toBe('記者')
    expect(screen.queryByRole('region', { name: '保存競合' })).toBeNull()
    expect(mockedSaveSheet).toHaveBeenCalledTimes(1)
  })

  it('select 競合の options 外 current は生値へフォールバックして表示する', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() })
    mockedSaveSheet.mockResolvedValueOnce(mergeConflict('main.job', 'legacy-value'))
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={selectCharacter} template={selectTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('combobox', { name: '職業' }))
    fireEvent.click(await screen.findByRole('option', { name: '医師' }))
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(await screen.findByText('相手の値: legacy-value')).toBeTruthy()
  })

  it.each([
    [true, 'チェックあり'],
    [false, 'チェックなし']
  ] as const)('boolean 競合の current:%s を「%s」と表示する', async (current, label) => {
    // 競合 wire の boolean を未入力や英語表記へ退行させず、日本語 UI の語彙へ揃える。
    mockedSaveSheet.mockResolvedValueOnce(mergeConflict('main.alive', current))
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={booleanCharacter} template={booleanTemplate} />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('checkbox', { name: '生存' }))
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(await screen.findByText(`相手の値: ${label}`)).toBeTruthy()
  })

  it('computed-only template でも TFR の section 見出しと空状態案内を併置する', () => {
    const computedOnlyTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [{
        ...template.sections[0]!,
        fields: [{
          id: 'total',
          uid: 'main.total',
          label: '合計',
          type: 'computed',
          resultType: 'number',
          formula: '1'
        }]
      }]
    }
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={character} template={computedOnlyTemplate} />
      </MantineProvider>
    )

    // 空状態案内だけで TFR を置換せず、computed-only でも renderer の全展開モードを維持する。
    expect(screen.getByRole('alert').textContent).toContain('このテンプレートには編集対象の scalar がありません。')
    expect(screen.getByRole('heading', { level: 3, name: 'メイン' })).toBeTruthy()
    expect((screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('annotation 付き非 editable template でも TFR の block 見出しを描画する', () => {
    const annotatedComputedTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [{
        ...template.sections[0]!,
        blocks: [{ id: 'summary', label: '集計結果' }],
        fields: [{
          id: 'total',
          uid: 'main.total',
          label: '合計',
          type: 'computed',
          resultType: 'number',
          formula: '1',
          blockId: 'summary'
        }]
      }]
    }
    render(
      <MantineProvider>
        <CharacterSheetEditClient character={character} template={annotatedComputedTemplate} />
      </MantineProvider>
    )

    expect(screen.getByRole('heading', { level: 4, name: '集計結果' })).toBeTruthy()
  })

  it('ページ h2 配下の template section 見出しを h3 で描画する', () => {
    renderEditor()

    expect(screen.getByRole('heading', { level: 3, name: 'メイン' })).toBeTruthy()
  })
})
