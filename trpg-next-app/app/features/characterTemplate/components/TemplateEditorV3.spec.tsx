/** @jest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

function templateWithField(field: SheetField): CharacterSheetTemplateEntity {
  return {
    ...initialTemplate,
    sections: [{ id: 'test', label: 'test', fields: [field] }]
  }
}

function templateWithSection(section: SheetSection): CharacterSheetTemplateEntity {
  return { ...initialTemplate, sections: [section] }
}

const blockIdFieldCases: Array<[string, SheetField]> = [
  ['text', { id: 'text', uid: 'uid_text', label: 'text', type: 'scalar', valueType: 'text' }],
  [
    'computed',
    { id: 'computed', uid: 'uid_computed', label: 'computed', type: 'computed', resultType: 'number', formula: '0' }
  ],
  ['roll', { id: 'roll', uid: 'uid_roll', label: 'roll', type: 'roll', notation: '1d100' }],
  ['track', { id: 'track', uid: 'uid_track', label: 'track', type: 'track', max: 10, style: 'gauge' }],
  ['list', { id: 'list', uid: 'uid_list', label: 'list', type: 'list', itemFields: [] }],
  ['relation', { id: 'relation', uid: 'uid_relation', label: 'relation', type: 'relation' }],
  ['tag', { id: 'tag', uid: 'uid_tag', label: 'tag', type: 'tag' }]
]

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

describe('TemplateEditorV3 field annotations', () => {
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

  it.each(blockIdFieldCases)('%s field の blockId を set/clear する', async (_fieldType, field) => {
    renderEditor(
      templateWithSection({
        id: 'test',
        label: 'test',
        blocks: [{ id: 'combat', label: '戦闘' }],
        fields: [field]
      })
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'blockId' }), { target: { value: 'combat' } })
    await advanceAutosave()

    const setField = mockedSaveTemplateDraft.mock.calls[0]?.[2].sections[0]?.fields[0]
    expect(setField?.blockId).toBe('combat')

    fireEvent.change(screen.getByRole('combobox', { name: 'blockId' }), { target: { value: '' } })
    await advanceAutosave()

    const clearedField = mockedSaveTemplateDraft.mock.calls[1]?.[2].sections[0]?.fields[0]
    expect(clearedField?.blockId).toBeUndefined()
    expect(JSON.stringify(clearedField)).not.toContain('blockId')
  })

  it('blockId 候補は field が属する section の block id のみにする', () => {
    renderEditor({
      ...initialTemplate,
      sections: [
        {
          id: 'first',
          label: 'first',
          blocks: [
            { id: 'combat', label: '戦闘' },
            { id: 'social', label: '交渉' }
          ],
          fields: [{ id: 'first_field', uid: 'uid_first', label: 'first field', type: 'scalar', valueType: 'text' }]
        },
        {
          id: 'second',
          label: 'second',
          blocks: [{ id: 'foreign', label: '別セクション' }],
          fields: [{ id: 'second_field', uid: 'uid_second', label: 'second field', type: 'scalar', valueType: 'text' }]
        }
      ]
    })

    fireEvent.focus(screen.getByRole('combobox', { name: 'blockId' }))
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['combat', 'social'])
    expect(screen.queryByRole('option', { name: 'foreign' })).toBeNull()
  })

  it('section タブ切替時に field 詳細を閉じ、元のタブへ戻ると復元する', () => {
    renderEditor({
      ...initialTemplate,
      sections: [
        {
          id: 'first',
          label: 'first',
          fields: [{ id: 'first_field', uid: 'uid_first', label: 'first field', type: 'scalar', valueType: 'text' }]
        },
        {
          id: 'second',
          label: 'second',
          fields: [{ id: 'second_field', uid: 'uid_second', label: 'second field', type: 'scalar', valueType: 'text' }]
        }
      ]
    })

    expect(screen.getByText('フィールド詳細')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('tab', { name: 'second' })[0]!)
    expect(screen.queryByText('フィールド詳細')).toBeNull()
    fireEvent.click(screen.getAllByRole('tab', { name: 'first' })[0]!)
    expect(screen.getByText('フィールド詳細')).toBeTruthy()
    expect(screen.getByDisplayValue('first_field')).toBeTruthy()
  })

  it('number scalar の max を number/formula で set/clear する', async () => {
    renderEditor(
      templateWithField({ id: 'score', uid: 'uid_score', label: 'score', type: 'scalar', valueType: 'number' })
    )

    fireEvent.change(screen.getByLabelText('max'), { target: { value: '99' } })
    await advanceAutosave()
    expect(mockedSaveTemplateDraft.mock.calls[0]?.[2].sections[0]?.fields[0]).toMatchObject({ max: 99 })

    fireEvent.click(screen.getByRole('radio', { name: 'formula' }))
    fireEvent.change(screen.getByLabelText('max formula'), { target: { value: '{ability.edu}' } })
    await advanceAutosave()
    expect(mockedSaveTemplateDraft.mock.calls[1]?.[2].sections[0]?.fields[0]).toMatchObject({
      max: { formula: '{ability.edu}' }
    })

    fireEvent.click(screen.getByRole('radio', { name: 'number' }))
    await advanceAutosave()
    const clearedField = mockedSaveTemplateDraft.mock.calls[2]?.[2].sections[0]?.fields[0]
    expect((clearedField as { max?: unknown }).max).toBeUndefined()
    expect(JSON.stringify(clearedField)).not.toContain('max')
  })

  it('非 required の formula を空にしても入力欄を維持し、式を打ち直せる', async () => {
    renderEditor(
      templateWithField({
        id: 'score',
        uid: 'uid_score',
        label: 'score',
        type: 'scalar',
        valueType: 'number',
        max: { formula: '{ability.edu}' }
      })
    )

    fireEvent.change(screen.getByLabelText('max formula'), { target: { value: '' } })
    expect(screen.getByLabelText('max formula')).toBeTruthy()
    await advanceAutosave()
    expect(mockedSaveTemplateDraft.mock.calls[0]?.[2].sections[0]?.fields[0]).toMatchObject({
      max: { formula: '' }
    })

    fireEvent.change(screen.getByLabelText('max formula'), { target: { value: '{ability.dex} * 2' } })
    await advanceAutosave()
    expect(mockedSaveTemplateDraft.mock.calls[1]?.[2].sections[0]?.fields[0]).toMatchObject({
      max: { formula: '{ability.dex} * 2' }
    })
  })

  it.each([
    ['text scalar', { id: 'text', uid: 'uid_text', label: 'text', type: 'scalar', valueType: 'text' }],
    ['computed', { id: 'computed', uid: 'uid_computed', label: 'computed', type: 'computed', resultType: 'number', formula: '0' }]
  ] as Array<[string, SheetField]>)('%s には max/partsKeys を表示しない', (_fieldType, field) => {
    renderEditor(templateWithField(field))

    expect(screen.queryByLabelText('max')).toBeNull()
    expect(screen.queryByText('partsKeys')).toBeNull()
  })

  it('partsKeys の id/label 行を追加・編集し、最終行の削除で property を落とす', async () => {
    renderEditor(
      templateWithField({ id: 'score', uid: 'uid_score', label: 'score', type: 'scalar', valueType: 'number' })
    )

    fireEvent.click(screen.getByRole('button', { name: 'parts キー追加' }))
    fireEvent.change(screen.getByLabelText('partsKeys 1 id'), { target: { value: 'career' } })
    fireEvent.change(screen.getByLabelText('partsKeys 1 label'), { target: { value: '職業' } })
    expect(screen.queryByLabelText('partsKeys 1 formula')).toBeNull()
    await advanceAutosave()

    expect(mockedSaveTemplateDraft.mock.calls[0]?.[2].sections[0]?.fields[0]).toMatchObject({
      partsKeys: [{ id: 'career', label: '職業' }]
    })

    fireEvent.click(screen.getByRole('button', { name: 'partsKeys 1 を削除' }))
    await advanceAutosave()

    const clearedField = mockedSaveTemplateDraft.mock.calls[1]?.[2].sections[0]?.fields[0]
    expect((clearedField as { partsKeys?: unknown }).partsKeys).toBeUndefined()
    expect(JSON.stringify(clearedField)).not.toContain('partsKeys')
  })

  it('parts:true の number scalar では partsKeys 編集を無効化する', () => {
    renderEditor(
      templateWithField({
        id: 'score',
        uid: 'uid_score',
        label: 'score',
        type: 'scalar',
        valueType: 'number',
        parts: true
      })
    )

    expect(screen.getByText('parts:true と partsKeys は併存できないため、partsKeys の編集を無効化しています。')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'parts キー追加' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('TemplateEditorV3 section blocks and pools', () => {
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

  it('blocks を追加・編集・並べ替えし、cap と最終行の clear で property を落とす', async () => {
    renderEditor(templateWithSection({ id: 'test', label: 'test', fields: [] }))

    fireEvent.click(screen.getByRole('button', { name: 'block 追加' }))
    fireEvent.click(screen.getByRole('button', { name: 'block 追加' }))
    fireEvent.change(screen.getByLabelText('blocks 1 id'), { target: { value: 'combat' } })
    fireEvent.change(screen.getByLabelText('blocks 1 label'), { target: { value: '戦闘' } })
    fireEvent.change(screen.getByLabelText('blocks 1 cap'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('blocks 2 id'), { target: { value: 'social' } })
    fireEvent.change(screen.getByLabelText('blocks 2 label'), { target: { value: '交渉' } })
    const secondCapMode = screen.getByLabelText('blocks 2 cap 入力方式')
    fireEvent.click(within(secondCapMode).getByRole('radio', { name: 'formula' }))
    fireEvent.change(screen.getByLabelText('blocks 2 cap formula'), { target: { value: '{ability.edu}' } })
    fireEvent.click(screen.getByRole('button', { name: 'blocks 2 を上へ' }))
    await advanceAutosave()

    expect(mockedSaveTemplateDraft.mock.calls[0]?.[2].sections[0]?.blocks).toEqual([
      { id: 'social', label: '交渉', cap: { formula: '{ability.edu}' } },
      { id: 'combat', label: '戦闘', cap: 80 }
    ])

    const firstCapMode = screen.getByLabelText('blocks 1 cap 入力方式')
    fireEvent.click(within(firstCapMode).getByRole('radio', { name: 'number' }))
    await advanceAutosave()
    const clearedCap = mockedSaveTemplateDraft.mock.calls[1]?.[2].sections[0]?.blocks?.[0]
    expect(clearedCap?.cap).toBeUndefined()
    expect(JSON.stringify(clearedCap)).not.toContain('cap')

    fireEvent.click(screen.getByRole('button', { name: 'blocks 1 を削除' }))
    fireEvent.click(screen.getByRole('button', { name: 'blocks 1 を削除' }))
    await advanceAutosave()
    const clearedBlocksSection = mockedSaveTemplateDraft.mock.calls[2]?.[2].sections[0]
    expect(clearedBlocksSection?.blocks).toBeUndefined()
    expect(JSON.stringify(clearedBlocksSection)).not.toContain('blocks')
  })

  it('number の cap を formula に切り替えて式を保存する', async () => {
    renderEditor(
      templateWithSection({
        id: 'test',
        label: 'test',
        blocks: [{ id: 'combat', label: '戦闘', cap: 80 }],
        fields: []
      })
    )

    const capMode = screen.getByLabelText('blocks 1 cap 入力方式')
    fireEvent.click(within(capMode).getByRole('radio', { name: 'formula' }))
    const formulaInput = screen.getByLabelText('blocks 1 cap formula')
    expect(formulaInput).toBeTruthy()
    await advanceAutosave()
    expect(mockedSaveTemplateDraft.mock.calls[0]?.[2].sections[0]?.blocks?.[0]?.cap).toEqual({ formula: '' })

    fireEvent.change(formulaInput, { target: { value: '{ability.edu}' } })
    await advanceAutosave()

    const savedBlock = mockedSaveTemplateDraft.mock.calls[1]?.[2].sections[0]?.blocks?.[0]
    expect(savedBlock?.cap).toEqual({ formula: '{ability.edu}' })
    expect(JSON.stringify(savedBlock)).toContain('"formula":"{ability.edu}"')
  })

  it('pool 先頭行の削除後も生き残る total の formula と値を保持する', async () => {
    renderEditor(
      templateWithSection({
        id: 'test',
        label: 'test',
        fields: [],
        pools: [
          { id: 'numeric', label: '数値', total: 10, partsKey: 'career' },
          { id: 'formula', label: '式', total: { formula: '{x}' }, partsKey: 'career' }
        ]
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'pools 1 を削除' }))

    const formulaInput = screen.getByLabelText('pools 1 total formula') as HTMLInputElement
    expect(formulaInput.value).toBe('{x}')
    await advanceAutosave()

    const savedPool = mockedSaveTemplateDraft.mock.calls[0]?.[2].sections[0]?.pools?.[0]
    expect(savedPool?.total).toEqual({ formula: '{x}' })
    expect(JSON.stringify(savedPool)).toContain('"formula":"{x}"')
  })

  it('partsKey/scope の選択肢と自由入力を反映し、scope/pools clear 後も total を保持する', async () => {
    renderEditor(
      templateWithSection({
        id: 'test',
        label: 'test',
        blocks: [
          { id: 'combat', label: '戦闘' },
          { id: 'social', label: '交渉' }
        ],
        fields: [
          {
            id: 'score',
            uid: 'uid_score',
            label: 'score',
            type: 'scalar',
            valueType: 'number',
            partsKeys: [
              { id: 'career', label: '職業' },
              { id: 'hobby', label: '趣味' }
            ]
          }
        ]
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'pool 追加' }))
    fireEvent.change(screen.getByLabelText('pools 1 id'), { target: { value: 'career_pool' } })
    fireEvent.change(screen.getByLabelText('pools 1 label'), { target: { value: '職業ポイント' } })
    const totalMode = screen.getByLabelText('pools 1 total 入力方式')
    fireEvent.click(within(totalMode).getByRole('radio', { name: 'formula' }))
    fireEvent.change(screen.getByLabelText('pools 1 total formula'), {
      target: { value: '{ability.edu} * 2' }
    })

    const partsKeyInput = screen.getByRole('combobox', { name: 'pools 1 partsKey' })
    fireEvent.focus(partsKeyInput)
    const partsKeyOptions = screen.getAllByRole('option').map((option) => option.textContent)
    expect(partsKeyOptions).toEqual(['career', 'hobby'])
    expect(partsKeyOptions).not.toContain('base')
    expect(partsKeyOptions).not.toContain('other')
    fireEvent.change(partsKeyInput, { target: { value: 'custom' } })

    const scopeInput = screen.getByRole('combobox', { name: 'pools 1 scope' })
    fireEvent.click(scopeInput)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['combat', 'social'])
    fireEvent.click(screen.getByRole('option', { name: 'combat' }))
    fireEvent.click(screen.getByRole('option', { name: 'social' }))
    await advanceAutosave()

    expect(mockedSaveTemplateDraft.mock.calls[0]?.[2].sections[0]?.pools).toEqual([
      {
        id: 'career_pool',
        label: '職業ポイント',
        total: { formula: '{ability.edu} * 2' },
        partsKey: 'custom',
        scope: ['combat', 'social']
      }
    ])

    fireEvent.click(screen.getByRole('button', { name: 'pools 1 scope clear' }))
    fireEvent.change(screen.getByLabelText('pools 1 total formula'), { target: { value: '' } })
    await advanceAutosave()
    const clearedPool = mockedSaveTemplateDraft.mock.calls[1]?.[2].sections[0]?.pools?.[0]
    expect(clearedPool?.total).toEqual({ formula: '' })
    expect(clearedPool?.scope).toBeUndefined()
    expect(JSON.stringify(clearedPool)).not.toContain('scope')

    fireEvent.click(screen.getByRole('button', { name: 'pools 1 を削除' }))
    await advanceAutosave()
    const clearedPoolsSection = mockedSaveTemplateDraft.mock.calls[2]?.[2].sections[0]
    expect(clearedPoolsSection?.pools).toBeUndefined()
    expect(JSON.stringify(clearedPoolsSection)).not.toContain('pools')
  })

  it('MultiSelect で scope をすべて外すと property を落とす', async () => {
    renderEditor(
      templateWithSection({
        id: 'test',
        label: 'test',
        blocks: [
          { id: 'combat', label: '戦闘' },
          { id: 'social', label: '交渉' }
        ],
        fields: [],
        pools: [
          {
            id: 'career_pool',
            label: '職業ポイント',
            total: 10,
            partsKey: 'career',
            scope: ['combat', 'social']
          }
        ]
      })
    )

    const scopeInput = screen.getByRole('combobox', { name: 'pools 1 scope' })
    fireEvent.keyDown(scopeInput, { key: 'Backspace' })
    fireEvent.keyDown(scopeInput, { key: 'Backspace' })
    await advanceAutosave()

    const savedPool = mockedSaveTemplateDraft.mock.calls[0]?.[2].sections[0]?.pools?.[0]
    expect(savedPool?.scope).toBeUndefined()
    expect(JSON.stringify(savedPool)).not.toContain('scope')
  })
})
