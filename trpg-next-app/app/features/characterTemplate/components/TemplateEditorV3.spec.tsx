/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { saveTemplateDraft } from '../actions'
import type { CharacterSheetTemplateEntity, LookupTable } from '../types/v3'
import { TemplateEditorV3 } from './TemplateEditorV3'

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

async function advanceAutosave(milliseconds = 1800) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds)
  })
}

describe('TemplateEditorV3 autosave', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    mockedSaveTemplateDraft.mockImplementation(async (_templateId, intent, payload) => ({
      ok: true,
      intent,
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
    await advanceAutosave(3600)

    expect(mockedSaveTemplateDraft).toHaveBeenCalledTimes(1)
  })

  it('tables の編集内容を recovery cache に保持する', () => {
    renderEditor()

    editTables()

    const cached = localStorage.getItem(`ct.templateDraft.v3.${initialTemplate.templateId}`)
    expect(cached).not.toBeNull()
    expect(JSON.parse(cached as string)).toEqual(expect.objectContaining({ tablesText: editedTablesText }))
  })

  it('autosave の reject を表示し、tables の編集内容を保持する', async () => {
    const saveError = new Error('draft save failed')
    mockedSaveTemplateDraft.mockRejectedValue(saveError)
    renderEditor()

    editTables()
    await advanceAutosave()

    expect(screen.getByText(saveError.message)).toBeTruthy()
    expect((screen.getByLabelText('tables') as HTMLTextAreaElement).value).toBe(editedTablesText)
  })
})
