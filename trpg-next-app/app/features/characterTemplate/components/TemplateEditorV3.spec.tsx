/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { saveTemplateDraft } from '../actions'
import type { CharacterSheetTemplateEntity, LookupTable } from '../types/v3'
import { AUTOSAVE_DEBOUNCE_MS, TemplateEditorV3 } from './TemplateEditorV3'

jest.mock('../actions', () => ({
  saveTemplateDraft: jest.fn()
}))

const initialTemplate: CharacterSheetTemplateEntity = {
  templateId: 'template-1',
  name: '探索者テンプレート',
  version: '1.0.0',
  schemaVersion: 3,
  tags: [],
  visibility: 'private',
  authorDiscordUserId: 'discord-user-1',
  status: 'draft',
  draftRevision: 1,
  sections: [
    {
      id: 'basic',
      label: '基本',
      fields: [{ id: 'name', uid: 'uid_name', label: '名前', type: 'scalar', valueType: 'text' }]
    }
  ],
  tables: [],
  settings: { rounding: 'floor' }
}

const editedTables: LookupTable[] = [{ id: 'luck', rows: [['01', '大成功']] }]
const editedTablesText = JSON.stringify(editedTables, null, 2)
const reEditedTablesText = JSON.stringify([{ id: 'luck', rows: [['02', '成功']] }], null, 2)
const mockedSaveTemplateDraft = jest.mocked(saveTemplateDraft)

function renderEditor() {
  return render(
    <MantineProvider>
      <TemplateEditorV3 initialTemplate={initialTemplate} />
    </MantineProvider>
  )
}

function editTables() {
  fireEvent.change(screen.getByLabelText('tables'), { target: { value: editedTablesText } })
}

async function advanceAutosave(milliseconds = AUTOSAVE_DEBOUNCE_MS) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds)
  })
}

describe('TemplateEditorV3 autosave', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockedSaveTemplateDraft.mockImplementation(async (_templateId, _intent, payload) => ({
      template: { ...payload, draftRevision: payload.draftRevision + 1 }
    }))
  })

  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  it('tables だけの編集を autosave payload に反映する', async () => {
    renderEditor()

    editTables()
    await advanceAutosave()

    expect(mockedSaveTemplateDraft).toHaveBeenCalledTimes(1)
    expect(mockedSaveTemplateDraft).toHaveBeenCalledWith(
      initialTemplate.templateId,
      'autosave',
      expect.objectContaining({ tables: editedTables })
    )
  })

  it('保存成功後の再整形では autosave を再実行しない', async () => {
    renderEditor()

    editTables()
    await advanceAutosave()
    await advanceAutosave(AUTOSAVE_DEBOUNCE_MS * 2)

    expect(mockedSaveTemplateDraft).toHaveBeenCalledTimes(1)
  })

  it('autosave の reject を表示し、tables の編集内容を保持する', async () => {
    const saveError = new Error('draft save failed')
    mockedSaveTemplateDraft.mockRejectedValue(saveError)
    renderEditor()

    editTables()
    await advanceAutosave()

    expect(
      screen.getByText('保存リクエストの送信に失敗しました。ネットワークを確認して再試行してください。')
    ).toBeTruthy()
    expect((screen.getByLabelText('tables') as HTMLTextAreaElement).value).toBe(editedTablesText)
  })

  it('template のない失敗応答後も再編集で autosave を再実行する', async () => {
    mockedSaveTemplateDraft.mockResolvedValueOnce({ conflict: false, messages: ['保存に失敗しました'] })
    renderEditor()

    editTables()
    await advanceAutosave()

    expect(screen.getByText('保存に失敗しました')).toBeTruthy()
    expect(mockedSaveTemplateDraft).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText('tables'), { target: { value: reEditedTablesText } })
    await advanceAutosave()

    expect(mockedSaveTemplateDraft).toHaveBeenCalledTimes(2)
  })
})
