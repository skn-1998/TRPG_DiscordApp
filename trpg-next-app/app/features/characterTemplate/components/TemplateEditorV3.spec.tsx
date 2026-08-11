/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import layoutNormalizationCases from '@trpg/sheet-engine/fixtures/layout-normalization.json'
import { validatePublishTemplate } from '@trpg/sheet-engine'
import { saveTemplateDraft } from '../actions'
import type { CharacterSheetTemplateEntity, LookupTable, SheetField, SheetSection } from '../types/v3'
import { toSheetTemplate } from '../utils/v3Template'
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

type LayoutFixtureSection = {
  id: string
  layout?: unknown
  fields: Array<{ type: string; id: string; layout?: unknown }>
}

type LayoutFixture = {
  name: string
  input: { sections: LayoutFixtureSection[] }
  expected: { sections: LayoutFixtureSection[] }
}

const layoutFixtures = layoutNormalizationCases as LayoutFixture[]

function renderEditor(template = initialTemplate) {
  return render(
    <MantineProvider>
      <TemplateEditorV3 initialTemplate={template} />
    </MantineProvider>
  )
}

function toPersistableSections(sections: LayoutFixtureSection[]): SheetSection[] {
  return sections.map((section) => ({
    ...section,
    label: section.id,
    fields: section.fields.map(toPersistableField)
  })) as SheetSection[]
}

function toPersistableField(field: LayoutFixtureSection['fields'][number]): SheetField {
  const base = { ...field, uid: `uid_${field.id}`, label: field.id }
  if (field.type === 'scalar') return { ...base, type: 'scalar', valueType: 'number' } as SheetField
  if (field.type === 'computed') {
    return { ...base, type: 'computed', resultType: 'number', formula: '0' } as SheetField
  }
  if (field.type === 'roll') return { ...base, type: 'roll', notation: '1d100' } as SheetField
  if (field.type === 'track') return { ...base, type: 'track', max: 10, style: 'gauge' } as SheetField
  if (field.type === 'list') return { ...base, type: 'list', itemFields: [] } as SheetField
  if (field.type === 'relation') return { ...base, type: 'relation' } as SheetField
  return { ...base, type: 'tag' } as SheetField
}

function toLayoutFixtureSections(sections: SheetSection[]): LayoutFixtureSection[] {
  return sections.map((section) => ({
    id: section.id,
    ...(section.layout === undefined ? {} : { layout: section.layout }),
    fields: section.fields.map((field) => ({
      type: field.type,
      id: field.id,
      ...(field.layout === undefined ? {} : { layout: field.layout })
    }))
  }))
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

  it.each(layoutFixtures)('$name を共有 fixture どおり autosave payload に正規化する', async ({ input, expected }) => {
    renderEditor({ ...initialTemplate, sections: toPersistableSections(input.sections) })

    editTables()
    await advanceAutosave()

    const persisted = mockedSaveTemplateDraft.mock.calls[0]?.[2]
    expect(persisted).toBeDefined()
    expect(toLayoutFixtureSections(persisted!.sections)).toEqual(expected.sections)
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

describe('TemplateEditorV3 publish validation warnings', () => {
  afterEach(cleanup)

  it('engine の警告を配列順のまま error と分離して表示し、publish をブロックしない', () => {
    const warningTemplate: CharacterSheetTemplateEntity = {
      ...initialTemplate,
      sections: [
        { id: 'legacy', label: 'legacy', fields: [], layout: { direction: 'row' } },
        {
          id: 'stack',
          label: 'stack',
          layout: { preset: 'stack' },
          fields: [
            {
              id: 'value',
              uid: 'uid_value',
              label: 'value',
              type: 'scalar',
              valueType: 'number',
              layout: { span: 2 }
            }
          ]
        }
      ]
    }
    const publishResult = validatePublishTemplate(toSheetTemplate(warningTemplate))
    const warningLines = publishResult.warnings.map(({ path, message }) => `[${path}] ${message}`)

    renderEditor(warningTemplate)
    fireEvent.click(screen.getByRole('button', { name: '検証' }))

    const warningAlert = screen.getByText('検証警告').closest('[role="alert"]')
    const alertText = warningAlert?.textContent ?? ''
    const renderedPositions = warningLines.map((line) => alertText.indexOf(line))
    expect(publishResult.ok).toBe(true)
    expect(publishResult.warnings.length).toBeGreaterThan(1)
    expect(renderedPositions.every((position) => position >= 0)).toBe(true)
    expect(renderedPositions).toEqual([...renderedPositions].sort((left, right) => left - right))
    expect(screen.queryByText('検証/保存エラー')).toBeNull()
    expect((screen.getByRole('button', { name: 'publish' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('engine の警告がゼロなら警告 Alert を表示しない', () => {
    const publishResult = validatePublishTemplate(toSheetTemplate(initialTemplate))

    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: '検証' }))

    expect(publishResult.warnings).toEqual([])
    expect(screen.queryByText('検証警告')).toBeNull()
  })
})
