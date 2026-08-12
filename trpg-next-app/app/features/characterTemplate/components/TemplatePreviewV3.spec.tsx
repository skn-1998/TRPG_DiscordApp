/** @jest-environment jsdom */

/**
 * TemplatePreviewV3 が TemplateFormRenderer に委譲する入力と、自身が所有する評価・roll・section 切替を固定する。
 */

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { evaluateTemplate } from '@trpg/sheet-engine'
import type { CharacterSheetTemplateEntity, SheetField } from '../types/v3'
import { TemplatePreviewV3 } from './TemplatePreviewV3'

jest.mock('@trpg/sheet-engine', () => {
  const actual = jest.requireActual<typeof import('@trpg/sheet-engine')>('@trpg/sheet-engine')
  return { ...actual, evaluateTemplate: jest.fn(actual.evaluateTemplate) }
})
jest.mock('../../characterSheet/TemplateFormRenderer.module.css', () => ({
  __esModule: true,
  default: {
    fieldContainer: 'fieldContainer',
    gridField: 'gridField',
    tableScroll: 'tableScroll'
  }
}))

const evaluateTemplateMock = jest.mocked(evaluateTemplate)
const actualEvaluateTemplate = jest.requireActual<typeof import('@trpg/sheet-engine')>(
  '@trpg/sheet-engine'
).evaluateTemplate
const nativeFetch = globalThis.fetch

function createPreviewTemplate(fields: SheetField[]): CharacterSheetTemplateEntity {
  return {
    templateId: 'template-preview',
    name: 'プレビューテンプレート',
    version: '1.0.0',
    schemaVersion: 3,
    tags: [],
    visibility: 'private',
    authorDiscordUserId: 'discord-user-1',
    sections: [{ id: 'main', label: 'メイン', fields }],
    tables: [],
    settings: { rounding: 'floor' },
    status: 'draft',
    draftRevision: 1
  }
}

function renderPreview(template: CharacterSheetTemplateEntity) {
  return render(
    <MantineProvider>
      <TemplatePreviewV3 template={template} />
    </MantineProvider>
  )
}

function readPreviewValues(): Record<string, unknown> {
  const values = document.querySelector('details pre')
  expect(values).toBeTruthy()
  return JSON.parse(values?.textContent ?? '') as Record<string, unknown>
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() })
})

afterEach(() => {
  cleanup()
  evaluateTemplateMock.mockImplementation(actualEvaluateTemplate)
  if (nativeFetch === undefined) {
    Reflect.deleteProperty(globalThis, 'fetch')
  } else {
    globalThis.fetch = nativeFetch
  }
})

describe('TemplatePreviewV3 characterization', () => {
  it('scalar 4 valueType を NumberInput・Select・Checkbox・TextInput へ割り当てる', () => {
    renderPreview(createPreviewTemplate([
      { id: 'number', uid: 'uid_number', label: '数値', type: 'scalar', valueType: 'number' },
      {
        id: 'select',
        uid: 'uid_select',
        label: '選択',
        type: 'scalar',
        valueType: 'select',
        options: [{ label: '探偵', value: 'detective' }]
      },
      { id: 'boolean', uid: 'uid_boolean', label: '真偽', type: 'scalar', valueType: 'boolean' },
      { id: 'text', uid: 'uid_text', label: '文字', type: 'scalar', valueType: 'text' }
    ]))

    const numberInput = screen.getByRole('textbox', { name: '数値' }) as HTMLInputElement
    const selectInput = screen.getByRole('combobox', { name: '選択' }) as HTMLInputElement
    const checkbox = screen.getByRole('checkbox', { name: '真偽' }) as HTMLInputElement
    const textInput = screen.getByRole('textbox', { name: '文字' }) as HTMLInputElement

    expect(numberInput.inputMode).toBe('decimal')
    expect(selectInput.readOnly).toBe(true)
    expect(checkbox.type).toBe('checkbox')
    expect(textInput.inputMode).toBe('')
  })

  it('number は評価済みの 0 を表示し、数値を保持して clear を通知しない', () => {
    renderPreview(createPreviewTemplate([
      { id: 'number', uid: 'uid_number', label: '数値', type: 'scalar', valueType: 'number' }
    ]))

    const input = screen.getByRole('textbox', { name: '数値' }) as HTMLInputElement
    expect(input.value).toBe('0')
    expect(readPreviewValues()).toEqual({})

    fireEvent.change(input, { target: { value: '42' } })
    expect(input.value).toBe('42')
    expect(readPreviewValues()).toEqual({ uid_number: 42 })

    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
    expect(readPreviewValues()).toEqual({ uid_number: 42 })
  })

  it('select は未選択を空表示し、deselect を通知せず評価済みの選択を維持する', async () => {
    const template = createPreviewTemplate([{
      id: 'select',
      uid: 'uid_select',
      label: '職業',
      type: 'scalar',
      valueType: 'select',
      options: [{ label: '探偵', value: 'detective' }]
    }])

    renderPreview(template)

    expect((screen.getByRole('combobox', { name: '職業' }) as HTMLInputElement).value).toBe('')
    expect(readPreviewValues()).toEqual({})
    cleanup()

    evaluateTemplateMock.mockReturnValueOnce({
      values: { uid_select: { type: 'text', value: 'detective' } },
      rows: {},
      evaluationOrder: [],
      resolvedRefs: []
    })
    renderPreview(template)

    const input = screen.getByRole('combobox', { name: '職業' }) as HTMLInputElement
    expect(input.value).toBe('探偵')
    fireEvent.click(input)
    fireEvent.click(await screen.findByRole('option', { name: '探偵' }))
    expect(input.value).toBe('探偵')
    expect(readPreviewValues()).toEqual({})
  })

  it('boolean の操作値を厳密な true・false として保持する', () => {
    renderPreview(createPreviewTemplate([
      { id: 'boolean', uid: 'uid_boolean', label: '有効', type: 'scalar', valueType: 'boolean' }
    ]))

    const checkbox = screen.getByRole('checkbox', { name: '有効' }) as HTMLInputElement
    expect(checkbox.checked).toBe(false)

    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
    expect(readPreviewValues()).toEqual({ uid_boolean: true })

    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
    expect(readPreviewValues()).toEqual({ uid_boolean: false })
  })

  it.each([
    ['truthy な文字列', { type: 'text' as const, value: 'yes' }, false],
    ['真偽値 true', { type: 'boolean' as const, value: true }, true]
  ])('boolean は runtime の %s を true との厳密比較で checked へ変換する', (_case, runtime, expected) => {
    evaluateTemplateMock.mockReturnValueOnce({
      values: { uid_boolean: runtime },
      rows: {},
      evaluationOrder: [],
      resolvedRefs: []
    })

    renderPreview(createPreviewTemplate([
      { id: 'boolean', uid: 'uid_boolean', label: '有効', type: 'scalar', valueType: 'boolean' }
    ]))

    expect((screen.getByRole('checkbox', { name: '有効' }) as HTMLInputElement).checked).toBe(expected)
  })

  it('computed は式を description に出し、評価結果を read-only 表示する', () => {
    const rawFormula = '{base} * 2'
    renderPreview(createPreviewTemplate([
      { id: 'base', uid: 'uid_base', label: '基礎値', type: 'scalar', valueType: 'number' },
      {
        id: 'computed',
        uid: 'uid_computed',
        label: '算出値',
        type: 'computed',
        resultType: 'number',
        formula: rawFormula
      }
    ]))

    const input = screen.getByRole('textbox', { name: '算出値' }) as HTMLInputElement
    expect(input.value).toBe('0')
    expect(input.readOnly).toBe(true)
    expect(screen.getByText(`式: ${rawFormula}`)).toBeTruthy()
    expect(screen.queryByText('式: {main.base} * 2')).toBeNull()
  })

  it('computed の評価失敗時は式評価エラーと Error 値を表示する', () => {
    renderPreview(createPreviewTemplate([{
      id: 'broken',
      uid: 'uid_broken',
      label: '失敗する算出値',
      type: 'computed',
      resultType: 'number',
      formula: '{main.broken}'
    }]))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('式評価エラー')
    expect(alert.textContent).toContain('Circular reference detected at uid_broken')
    expect((screen.getByRole('textbox', { name: '失敗する算出値' }) as HTMLInputElement).value).toBe('Error')
  })

  it('roll は記法を編集でき、対話的なロールボタンを表示する', () => {
    renderPreview(createPreviewTemplate([
      { id: 'roll', uid: 'uid_roll', label: '判定', type: 'roll', notation: '1d6' }
    ]))

    const input = screen.getByRole('textbox', { name: '判定' }) as HTMLInputElement
    expect(input.value).toBe('1d6')
    expect(input.readOnly).toBe(false)
    expect(screen.getByText('記法: 1d6')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'ロール' })).toBeTruthy()
  })

  it('roll 成功時は編集値が評価済みの基底値を上書きしてダイス合計を表示する', async () => {
    evaluateTemplateMock.mockReturnValue({
      values: { uid_roll: { type: 'text', value: '1d20' } },
      rows: {},
      evaluationOrder: [],
      resolvedRefs: []
    })
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ total: 17, details: '1d20=17' })
    } as Response)
    globalThis.fetch = fetchMock
    renderPreview(createPreviewTemplate([
      { id: 'roll', uid: 'uid_roll', label: '判定', type: 'roll', notation: '1d20' }
    ]))

    const input = screen.getByRole('textbox', { name: '判定' }) as HTMLInputElement
    expect(input.value).toBe('1d20')

    fireEvent.click(screen.getByRole('button', { name: 'ロール' }))

    expect(await screen.findByText('結果: 1d20=17')).toBeTruthy()
    expect(input.value).toBe('17')
    expect(readPreviewValues()).toEqual({ uid_roll: 17 })
    expect(fetchMock).toHaveBeenCalledWith('/templates/dice-preview', expect.objectContaining({ method: 'POST' }))
  })

  it('track・list・relation・tag を保存不能な入力ではなく placeholder として描画する', () => {
    renderPreview(createPreviewTemplate([
      { id: 'track', uid: 'uid_track', label: '耐久力', type: 'track', max: 10, style: 'gauge' },
      { id: 'list', uid: 'uid_list', label: '所持品', type: 'list', itemFields: [] },
      { id: 'relation', uid: 'uid_relation', label: '関係', type: 'relation' },
      { id: 'tag', uid: 'uid_tag', label: 'タグ', type: 'tag' }
    ]))

    for (const [fieldType, label] of [
      ['track', '耐久力'],
      ['list', '所持品'],
      ['relation', '関係'],
      ['tag', 'タグ']
    ]) {
      const placeholder = screen.getByText(label).closest(`[data-field-placeholder="${fieldType}"]`)
      expect(placeholder).toBeTruthy()
      expect(placeholder?.textContent).toContain(fieldType)
    }
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('全 section のタブを表示し、active tab の field だけを切り替えて描画する', () => {
    const template = {
      ...createPreviewTemplate([]),
      sections: [
        {
          id: 'first',
          label: '第一セクション',
          fields: [{ id: 'first', uid: 'uid_first', label: '第一入力', type: 'scalar' as const, valueType: 'text' as const }]
        },
        {
          id: 'second',
          label: '第二セクション',
          fields: [{ id: 'second', uid: 'uid_second', label: '第二入力', type: 'scalar' as const, valueType: 'text' as const }]
        }
      ]
    }

    renderPreview(template)

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['第一セクション', '第二セクション'])
    expect(screen.getByRole('heading', { level: 2, name: '第一セクション' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: '第一入力' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: '第二入力' })).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: '第二セクション' }))
    expect(screen.queryByRole('heading', { level: 2, name: '第一セクション' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: '第二セクション' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: '第一入力' })).toBeNull()
    expect(screen.getByRole('textbox', { name: '第二入力' })).toBeTruthy()
  })
})
