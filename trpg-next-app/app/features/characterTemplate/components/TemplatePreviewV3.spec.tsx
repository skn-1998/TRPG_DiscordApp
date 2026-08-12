/** @jest-environment jsdom */

/**
 * TemplatePreviewV3 が所有する型別 widget と入力・評価・section 切替の現挙動を固定する。
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

const evaluateTemplateMock = jest.mocked(evaluateTemplate)

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

afterEach(cleanup)

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

  it('number は空値を 0 として表示し、数値を保持して空文字を undefined へ正規化する', () => {
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
    expect(input.value).toBe('0')
    expect(readPreviewValues()).toEqual({})
  })

  it('select は未選択を空表示し、deselect を空文字で保持して選択済みラベルを残す', async () => {
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
    expect(readPreviewValues()).toEqual({ uid_select: '' })
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
    ['truthy な文字列', { type: 'text' as const, value: 'yes' }, true],
    ['falsy な数値', { type: 'number' as const, value: 0 }, false]
  ])('boolean は runtime の %s を Boolean で checked へ変換する', (_case, runtime, expected) => {
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
    renderPreview(createPreviewTemplate([{
      id: 'computed',
      uid: 'uid_computed',
      label: '算出値',
      type: 'computed',
      resultType: 'number',
      formula: '1 + 2'
    }]))

    const input = screen.getByRole('textbox', { name: '算出値' }) as HTMLInputElement
    expect(input.value).toBe('3')
    expect(input.readOnly).toBe(true)
    expect(screen.getByText('式: 1 + 2')).toBeTruthy()
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

  it('track・list・relation・tag を placeholder ではなく空の TextInput として描画する', () => {
    renderPreview(createPreviewTemplate([
      { id: 'track', uid: 'uid_track', label: '耐久力', type: 'track', max: 10, style: 'gauge' },
      { id: 'list', uid: 'uid_list', label: '所持品', type: 'list', itemFields: [] },
      { id: 'relation', uid: 'uid_relation', label: '関係', type: 'relation' },
      { id: 'tag', uid: 'uid_tag', label: 'タグ', type: 'tag' }
    ]))

    for (const label of ['耐久力', '所持品', '関係', 'タグ']) {
      const input = screen.getByRole('textbox', { name: label }) as HTMLInputElement
      expect(input.value).toBe('')
      expect(input.readOnly).toBe(false)
    }
    expect(document.querySelector('[data-field-placeholder]')).toBeNull()
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
    expect(screen.getByRole('textbox', { name: '第一入力' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: '第二入力' })).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: '第二セクション' }))
    expect(screen.queryByRole('textbox', { name: '第一入力' })).toBeNull()
    expect(screen.getByRole('textbox', { name: '第二入力' })).toBeTruthy()
  })
})
