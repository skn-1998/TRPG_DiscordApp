/** @jest-environment jsdom */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  DEFAULT_SHEET_FIELD_LAYOUT_SPAN,
  DEFAULT_SHEET_SECTION_GRID_COLUMNS,
  SHEET_FIELD_LAYOUT_SPANS,
  SHEET_SECTION_GRID_COLUMNS,
  allowsParts,
  evaluateAnnotationRuntime,
  type SheetField,
  type SheetTemplate,
  validatePublishTemplate
} from '@trpg/sheet-engine'
import engineIsNumberScalar from '../../../../packages/sheet-engine/src/annotation-runtime'
import styles from './TemplateFormRenderer.module.css'
import { TemplateFormRenderer } from './TemplateFormRenderer'

jest.mock('./TemplateFormRenderer.module.css', () => ({
  __esModule: true,
  default: {
    fieldContainer: 'fieldContainer',
    gridField: 'gridField',
    tableScroll: 'tableScroll'
  }
}))

const template: SheetTemplate = {
  templateId: 'template-1',
  name: '探索者テンプレート',
  version: '1.0.0',
  schemaVersion: 3,
  tags: [],
  visibility: 'private',
  authorDiscordUserId: 'discord-user-1',
  sections: [
    {
      id: 'profile',
      label: 'プロフィール',
      layout: { preset: 'grid', columns: 4 },
      fields: [
        { id: 'name', uid: 'uid_name', label: '名前', type: 'scalar', valueType: 'text', layout: { span: 1 } },
        {
          id: 'score',
          uid: 'uid_score',
          label: '算出値',
          type: 'computed',
          resultType: 'number',
          formula: '1',
          layout: { span: 2 }
        },
        { id: 'check', uid: 'uid_check', label: '判定', type: 'roll', notation: '1d100', layout: { span: 'full' } },
        { id: 'hp', uid: 'uid_hp', label: '耐久力', type: 'track', max: 10, style: 'gauge' },
        { id: 'items', uid: 'uid_items', label: '所持品', type: 'list', itemFields: [] },
        { id: 'bond', uid: 'uid_bond', label: '関係', type: 'relation' },
        { id: 'tags', uid: 'uid_tags', label: 'タグ', type: 'tag' }
      ]
    },
    {
      id: 'notes',
      label: 'メモ',
      layout: { preset: 'unknown', columns: 99 },
      fields: [{ id: 'note', uid: 'uid_note', label: '備考', type: 'scalar', valueType: 'text' }]
    }
  ],
  tables: [],
  settings: { rounding: 'floor' }
}

function renderForm(
  values: Record<string, unknown>,
  onChange?: (fieldUid: string, value: unknown) => void,
  targetTemplate: SheetTemplate = template,
  onPartsChange?: (fieldUid: string, partsKey: string, value: number) => void
) {
  return render(
    <MantineProvider>
      <TemplateFormRenderer
        template={targetTemplate}
        values={values}
        onChange={onChange}
        onPartsChange={onPartsChange}
      />
    </MantineProvider>
  )
}

function getFieldContainer(sectionLabel: string) {
  const section = screen.getByRole('heading', { level: 2, name: sectionLabel }).closest('section')
  const fieldContainer = section?.querySelector<HTMLElement>('[data-layout-mode]')

  expect(fieldContainer).toBeTruthy()
  return fieldContainer as HTMLElement
}

function getFieldCell(fieldUid: string) {
  const fieldCell = document.querySelector<HTMLElement>(`[data-field-uid="${fieldUid}"]`)

  expect(fieldCell).toBeTruthy()
  return fieldCell as HTMLElement
}

function moveFocusByDomOrder(current: HTMLElement, offset: -1 | 1) {
  const controls = Array.from(document.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]'))
    .filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0)
  act(() => controls[controls.indexOf(current) + offset]?.focus())
}

function createTableTemplate(fields = template.sections[0].fields): SheetTemplate {
  return {
    ...template,
    sections: [{ ...template.sections[0], label: 'テーブル', layout: { preset: 'table' }, fields }]
  }
}

function createBlockedTemplate(layout: unknown, blocks = [
  { id: 'stats', label: '能力値' },
  { id: 'skills', label: '技能' }
]): SheetTemplate {
  const fields: SheetField[] = [
    { id: 'skill-1', uid: 'uid_skill_1', label: '技能 1', type: 'scalar', valueType: 'text', blockId: 'skills' },
    { id: 'default-1', uid: 'uid_default_1', label: '既定 1', type: 'scalar', valueType: 'text' },
    { id: 'missing', uid: 'uid_missing', label: '不在参照', type: 'scalar', valueType: 'text', blockId: 'missing' },
    { id: 'stat-1', uid: 'uid_stat_1', label: '能力値 1', type: 'scalar', valueType: 'text', blockId: 'stats' },
    { id: 'skill-2', uid: 'uid_skill_2', label: '技能 2', type: 'scalar', valueType: 'text', blockId: 'skills' },
    { id: 'default-2', uid: 'uid_default_2', label: '既定 2', type: 'scalar', valueType: 'text' },
    { id: 'stat-2', uid: 'uid_stat_2', label: '能力値 2', type: 'scalar', valueType: 'text', blockId: 'stats' }
  ]

  return {
    ...template,
    sections: [{ ...template.sections[0], label: 'ブロック', layout, blocks, fields }]
  }
}

function createAnnotationTemplate(
  overrides: Partial<SheetTemplate['sections'][number]> = {}
): SheetTemplate {
  return {
    ...template,
    sections: [{
      id: 'skills',
      label: '技能',
      layout: { preset: 'stack' },
      fields: [{
        id: 'skill',
        uid: 'uid_skill',
        label: '技能値',
        type: 'scalar',
        valueType: 'number',
        partsKeys: [{ id: 'career', label: '職業' }]
      }],
      ...overrides
    }]
  }
}

function createDisplayValueSentinel(
  fieldUid: string,
  runtimeValue: unknown,
  rendererValue: unknown
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  // engine の初回 read 後だけ renderer 用 raw へ切り替え、displayValue の素通しを固定する。
  Object.defineProperty(values, fieldUid, {
    configurable: true,
    enumerable: true,
    get() {
      Object.defineProperty(values, fieldUid, { enumerable: true, value: rendererValue })
      return runtimeValue
    }
  })
  return values
}

const fieldPredicateBase = { id: 'field', uid: 'field-uid', label: 'Field' }
const fieldPredicateFixtures = [
  { name: 'scalar number', field: { ...fieldPredicateBase, type: 'scalar', valueType: 'number' } },
  { name: 'scalar text', field: { ...fieldPredicateBase, type: 'scalar', valueType: 'text' } },
  { name: 'scalar boolean', field: { ...fieldPredicateBase, type: 'scalar', valueType: 'boolean' } },
  { name: 'track', field: { ...fieldPredicateBase, type: 'track', max: 10, style: 'gauge' } },
  { name: 'roll', field: { ...fieldPredicateBase, type: 'roll', notation: '1d6' } },
  { name: 'computed', field: { ...fieldPredicateBase, type: 'computed', resultType: 'number', formula: '1' } },
  { name: 'list', field: { ...fieldPredicateBase, type: 'list', itemFields: [] } },
  { name: 'relation', field: { ...fieldPredicateBase, type: 'relation' } },
  { name: 'tag', field: { ...fieldPredicateBase, type: 'tag' } }
] satisfies Array<{ name: string; field: SheetField }>

const partsFieldPredicateFixtures = fieldPredicateFixtures.flatMap(({ name, field }) => [
  { name: `${name}: parts なし`, field },
  { name: `${name}: parts=true`, field: { ...field, parts: true } as SheetField },
  {
    name: `${name}: partsKeys`,
    field: { ...field, partsKeys: [{ id: 'part', label: 'Part' }] } as SheetField
  },
  {
    name: `${name}: parts 併存`,
    field: { ...field, parts: true, partsKeys: [{ id: 'part', label: 'Part' }] } as SheetField
  }
])

function readRendererCss() {
  return readFileSync(
    join(process.cwd(), 'app/features/characterSheet/TemplateFormRenderer.module.css'),
    'utf8'
  )
}

function readRendererSource() {
  return readFileSync(
    join(process.cwd(), 'app/features/characterSheet/TemplateFormRenderer.tsx'),
    'utf8'
  )
}

function getPropertyRules(css: string, property: string) {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)

  return [...rules].flatMap(([, selectorList, declarations]) => {
    const value = declarations.match(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`))?.[1]?.trim()
    return value === undefined
      ? []
      : [{ selectors: selectorList.split(',').map((selector) => selector.trim()), value }]
  })
}

type CssSpecificity = readonly [id: number, classLike: number, element: number]

function getSelectorSpecificity(selector: string): CssSpecificity {
  const withoutAttributes = selector.replace(/\[[^\]]+\]/g, '')
  const idCount = withoutAttributes.match(/#[\w-]+/g)?.length ?? 0
  const classCount = withoutAttributes.match(/\.[\w-]+/g)?.length ?? 0
  const attributeCount = selector.match(/\[[^\]]+\]/g)?.length ?? 0
  const pseudoClassCount = withoutAttributes.match(/(?<!:):(?!:)[\w-]+/g)?.length ?? 0
  const pseudoElementCount = withoutAttributes.match(/::[\w-]+/g)?.length ?? 0
  const elementCount = withoutAttributes
    .replace(/#[\w-]+|\.[\w-]+|::?[\w-]+/g, '')
    .match(/(?:^|[\s>+~])[a-zA-Z][\w-]*/g)?.length ?? 0

  return [idCount, classCount + attributeCount + pseudoClassCount, elementCount + pseudoElementCount]
}

function compareCssSpecificity(left: CssSpecificity, right: CssSpecificity) {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}

function expectMobileSpecificityAtLeastDesktop(desktopCss: string, mobileCss: string, property: string) {
  const desktopSpecificity = getPropertyRules(desktopCss, property)
    .flatMap(({ selectors }) => selectors.map(getSelectorSpecificity))
    .reduce<CssSpecificity>(
      (highest, candidate) => compareCssSpecificity(candidate, highest) > 0 ? candidate : highest,
      [0, 0, 0]
    )
  const mobileSpecificities = getPropertyRules(mobileCss, property)
    .flatMap(({ selectors }) => selectors.map(getSelectorSpecificity))

  expect(desktopSpecificity).not.toEqual([0, 0, 0])
  expect(mobileSpecificities.length).toBeGreaterThan(0)
  mobileSpecificities.forEach((mobileSpecificity) => {
    expect(compareCssSpecificity(mobileSpecificity, desktopSpecificity)).toBeGreaterThanOrEqual(0)
  })
}

function normalizeCssValue(value: string) {
  return value.trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
}

function expectRendererCssContract(css: string) {
  const cssSections = css.split('@media')
  expect(cssSections).toHaveLength(2)
  const [desktopCss, mobileCss = ''] = cssSections
  const columnSelector = /\[data-grid-columns='(\d+)'\]/g
  const spanSelector = /\[data-grid-span='(\d+|full)'\]/g
  const selectorVocabulary = (source: string, selector: RegExp) => new Set(
    [...source.matchAll(selector)].map(([, value]) => value === 'full' ? value : Number(value))
  )

  expect(selectorVocabulary(desktopCss, columnSelector)).toEqual(new Set(SHEET_SECTION_GRID_COLUMNS))
  expect(selectorVocabulary(mobileCss, columnSelector)).toEqual(new Set(SHEET_SECTION_GRID_COLUMNS))
  expect(selectorVocabulary(desktopCss, spanSelector)).toEqual(new Set(SHEET_FIELD_LAYOUT_SPANS))
  expect(selectorVocabulary(mobileCss, spanSelector)).toEqual(
    new Set(SHEET_FIELD_LAYOUT_SPANS.filter((span) => span === 'full' || span >= 2))
  )

  expectMobileSpecificityAtLeastDesktop(desktopCss, mobileCss, 'grid-template-columns')
  expectMobileSpecificityAtLeastDesktop(desktopCss, mobileCss, 'grid-column')
  expect(new Set(getPropertyRules(mobileCss, 'grid-template-columns').map(({ value }) => normalizeCssValue(value)))).toEqual(
    new Set([normalizeCssValue('repeat(2, minmax(0, 1fr))')])
  )
  expect(new Set(getPropertyRules(mobileCss, 'grid-column').map(({ value }) => normalizeCssValue(value)))).toEqual(
    new Set([normalizeCssValue('1 / -1')])
  )
}

afterEach(cleanup)

describe('TemplateFormRenderer', () => {
  it('front と engine の isNumberScalar が 9 型 field マトリクスで一致する', () => {
    const frontMatches = fieldPredicateFixtures.map(({ field }, index) => {
      const fieldWithPartsSkew = {
        ...field,
        uid: `${field.uid}-${index}`,
        partsKeys: [{ id: 'part', label: 'Part' }]
      } as SheetField
      const view = renderForm({}, undefined, createTableTemplate([fieldWithPartsSkew]))
      const matches = getFieldCell(fieldWithPartsSkew.uid).dataset.tableRowMode === 'parts'
      view.unmount()
      return matches
    })

    expect(frontMatches).toEqual(fieldPredicateFixtures.map(({ field }) => engineIsNumberScalar(field)))
  })

  it('front の isPartsScalarField が 9 型と parts 変種で engine allowsParts の scalar 部分と一致する', () => {
    const frontMatches = partsFieldPredicateFixtures.map(({ field }, index) => {
      const fixture = { ...field, uid: `${field.uid}-parts-${index}` } as SheetField
      const view = renderForm({}, undefined, createTableTemplate([fixture]))
      const rowMode = getFieldCell(fixture.uid).dataset.tableRowMode
      view.unmount()
      return rowMode === 'parts' || rowMode === 'parts-total'
    })

    expect(frontMatches).toEqual(
      partsFieldPredicateFixtures.map(({ field }) => allowsParts(field) && field.type === 'scalar')
    )
  })

  it('desktop / mobile CSS の selector 語彙・詳細度・collapse 値が契約と一致する', () => {
    expectRendererCssContract(readRendererCss())
    expect(getPropertyRules(readRendererCss(), 'overflow-x')).toContainEqual({
      selectors: ['.tableScroll'],
      value: 'auto'
    })
  })

  it('PartsEditorPopover の幅を target prop に固定する', () => {
    const source = readRendererSource()
    expect(source).toContain('width="target"')
    expect(source).not.toContain('width={280}')
  })

  it('mobile collapse 値の等価な空白差を許容する', () => {
    const css = readRendererCss()
    const mutatedCss = css.replace(
      /(@media[\s\S]*?grid-template-columns:\s*)repeat\(2, minmax\(0, 1fr\)\)/,
      '$1repeat( 2 , minmax( 0 , 1fr ) )'
    )

    expect(mutatedCss).not.toBe(css)
    expect(() => expectRendererCssContract(mutatedCss)).not.toThrow()
  })

  it.each([
    ['M1: mobile selector の詳細度低下', (css: string) => css.replace(
      /(@media[\s\S]*?)\.fieldContainer\[data-layout-mode='grid'\]\[data-grid-columns='4'\]/,
      "$1.fieldContainer[data-grid-columns='4']"
    )],
    ['M2: mobile columns の 4 列化', (css: string) => css.replace(
      /(@media[\s\S]*?grid-template-columns:\s*)repeat\(2,/,
      '$1repeat(4,'
    )],
    ['M3: mobile span 語彙の欠落', (css: string) => css.replace(
      /(@media[\s\S]*?),\s*\n\s*\.gridField\[data-grid-span='full'\]/,
      '$1'
    )],
    ['M4: @media の desktop 規則前への移動', (css: string) => {
      const mediaIndex = css.indexOf('@media')
      return `${css.slice(mediaIndex)}\n${css.slice(0, mediaIndex)}`
    }],
    ['M5: mobile columns 3 selector の class 脱落', (css: string) => css.replace(
      /(@media[\s\S]*?)\.fieldContainer(\[data-layout-mode='grid'\]\[data-grid-columns='3'\])/,
      '$1$2'
    )],
    ['M6: mobile columns 4 selector の class 脱落', (css: string) => css.replace(
      /(@media[\s\S]*?)\.fieldContainer(\[data-layout-mode='grid'\]\[data-grid-columns='4'\])/,
      '$1$2'
    )],
    ['M7: mobile span 2 selector の class 脱落', (css: string) => css.replace(
      /(@media[\s\S]*?)\.gridField(\[data-grid-span='2'\])/,
      '$1$2'
    )],
    ['M8: mobile span 3 selector の class 脱落', (css: string) => css.replace(
      /(@media[\s\S]*?)\.gridField(\[data-grid-span='3'\])/,
      '$1$2'
    )]
  ])('%s を CSS 契約違反として検知する', (_case, mutate) => {
    const css = readRendererCss()
    const mutatedCss = mutate(css)

    expect(mutatedCss).not.toBe(css)
    expect(() => expectRendererCssContract(mutatedCss)).toThrow()
  })

  it('セクションとフィールドを宣言順に描画し、grid と不正 preset の DOM 契約を公開する', () => {
    const { container } = renderForm({ uid_score: 42 })

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'プロフィール',
      'メモ'
    ])
    const content = container.textContent ?? ''
    expect(content.indexOf('名前')).toBeLessThan(content.indexOf('算出値'))
    expect(content.indexOf('算出値')).toBeLessThan(content.indexOf('判定'))
    expect(content.indexOf('プロフィール')).toBeLessThan(content.indexOf('メモ'))
    expect(screen.getByDisplayValue('42')).toBeTruthy()
    expect(screen.getByDisplayValue('—')).toBeTruthy()

    const grid = getFieldContainer('プロフィール')
    expect(grid.classList.contains(styles.fieldContainer)).toBe(true)
    expect(grid.dataset.layoutMode).toBe('grid')
    expect(grid.dataset.gridColumns).toBe('4')
    expect(getFieldCell('uid_name').dataset.gridSpan).toBe('1')
    expect(getFieldCell('uid_name').classList.contains(styles.gridField)).toBe(true)
    expect(getFieldCell('uid_score').dataset.gridSpan).toBe('2')
    expect(getFieldCell('uid_score').classList.contains(styles.gridField)).toBe(true)
    expect(getFieldCell('uid_check').dataset.gridSpan).toBe('full')
    expect(getFieldCell('uid_check').classList.contains(styles.gridField)).toBe(true)

    const fallback = getFieldContainer('メモ')
    expect(fallback.classList.contains(styles.fieldContainer)).toBe(true)
    expect(fallback.dataset.layoutMode).toBe('stack')
    expect(fallback.dataset.gridColumns).toBeUndefined()
  })

  it.each([
    ['legacy layout', { direction: 'row' }, 'stack', undefined],
    ['不正 preset', { preset: 'cards' }, 'stack', undefined],
    ['不正 columns', { preset: 'grid', columns: 5 }, 'grid', '2'],
    ['table の不正 columns', { preset: 'table', columns: 99 }, 'table', undefined]
  ])('%s を canonical layout へ退化させる（入力: %p / 期待: mode=%s, columns=%s）', (_case, layout, expectedMode, expectedColumns) => {
    const targetTemplate = {
      ...template,
      sections: [{ ...template.sections[1], label: '退化対象', layout }]
    }

    renderForm({}, undefined, targetTemplate)

    const fallback = getFieldContainer('退化対象')
    expect(fallback.classList.contains(styles.fieldContainer)).toBe(true)
    expect(fallback.dataset.layoutMode).toBe(expectedMode)
    expect(fallback.dataset.gridColumns).toBe(expectedColumns)
  })

  it('table を既定ブロックから宣言ブロック順に分け、各ブロック内の field 順を維持する', () => {
    renderForm({}, undefined, createBlockedTemplate({ preset: 'table' }))

    const section = screen.getByRole('heading', { level: 2, name: 'ブロック' }).closest('section') as HTMLElement
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      '能力値',
      '技能'
    ])
    expect(Array.from(section.querySelectorAll('table')).map((table) =>
      Array.from(table.rows).map((row) => row.dataset.fieldUid)
    )).toEqual([
      ['uid_default_1', 'uid_missing', 'uid_default_2'],
      ['uid_stat_1', 'uid_stat_2'],
      ['uid_skill_1', 'uid_skill_2']
    ])
  })

  it('headingLevel=3 では section を h3、block を h4 にする', () => {
    render(
      <MantineProvider>
        <TemplateFormRenderer
          headingLevel={3}
          template={createBlockedTemplate({ preset: 'stack' })}
          values={{}}
        />
      </MantineProvider>
    )

    expect(screen.getByRole('heading', { level: 3, name: 'ブロック' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: '能力値' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: '技能' })).toBeTruthy()
  })

  it('grid をブロックごとのコンテナに分け、canonical columns を各コンテナへ維持する', () => {
    renderForm({}, undefined, createBlockedTemplate({ preset: 'grid', columns: 4 }))

    const section = screen.getByRole('heading', { level: 2, name: 'ブロック' }).closest('section') as HTMLElement
    const grids = Array.from(section.querySelectorAll<HTMLElement>('[data-layout-mode="grid"]'))
    expect(grids).toHaveLength(3)
    grids.forEach((grid) => {
      expect(grid.classList.contains(styles.fieldContainer)).toBe(true)
      expect(grid.dataset.gridColumns).toBe('4')
    })
    expect(grids.map((grid) => Array.from(grid.querySelectorAll<HTMLElement>('[data-field-uid]'))
      .map((field) => field.dataset.fieldUid))).toEqual([
      ['uid_default_1', 'uid_missing', 'uid_default_2'],
      ['uid_stat_1', 'uid_stat_2'],
      ['uid_skill_1', 'uid_skill_2']
    ])
  })

  it.each([
    ['stack', { preset: 'stack' }],
    ['grid', { preset: 'grid', columns: 4 }],
    ['table', { preset: 'table' }]
  ])('%s では field のない宣言ブロックの見出しとコンテナを描画しない', (_preset, layout) => {
    const blocks = [
      { id: 'stats', label: '能力値' },
      { id: 'empty', label: '空宣言ブロック' },
      { id: 'skills', label: '技能' }
    ]
    renderForm({}, undefined, createBlockedTemplate(layout, blocks))

    const section = screen.getByRole('heading', { level: 2, name: 'ブロック' }).closest('section') as HTMLElement
    const containers = Array.from(section.querySelectorAll<HTMLElement>('[data-layout-mode]'))
    expect(screen.queryByRole('heading', { level: 3, name: '空宣言ブロック' })).toBeNull()
    expect(containers).toHaveLength(3)
    containers.forEach((container) => expect(container.querySelector('[data-field-uid]')).toBeTruthy())
  })

  it('blocks の重複 id は最初の見出しと順序を採用する', () => {
    const blocks = [
      { id: 'stats', label: '能力値（先）' },
      { id: 'skills', label: '技能' },
      { id: 'stats', label: '能力値（後）' }
    ]
    renderForm({}, undefined, createBlockedTemplate({ preset: 'stack' }, blocks))

    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      '能力値（先）',
      '技能'
    ])
    expect(screen.queryByRole('heading', { level: 3, name: '能力値（後）' })).toBeNull()
  })

  it('pool 宣言がある空 section も見出し・コンテナ・pool ごと描画しない', () => {
    const targetTemplate = createAnnotationTemplate({
      label: '空セクション',
      fields: [],
      pools: [{ id: 'orphan', label: '浮遊予算', total: 10, partsKey: 'career' }]
    })

    renderForm({}, undefined, targetTemplate)

    expect(screen.queryByRole('heading', { level: 2, name: '空セクション' })).toBeNull()
    expect(screen.queryByText('浮遊予算')).toBeNull()
    expect(document.querySelector('[data-layout-mode]')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('空 section を skip しても後続 section の annotation index を維持する', () => {
    const targetTemplate: SheetTemplate = {
      ...template,
      sections: [
        {
          id: 'empty', label: '空セクション', layout: { preset: 'stack' }, fields: []
        },
        {
          id: 'limited', label: '上限セクション', layout: { preset: 'stack' },
          fields: [{ id: 'limited', uid: 'uid_limited', label: '上限値', type: 'scalar', valueType: 'number', max: 5 }]
        }
      ]
    }

    renderForm({ uid_limited: 55 }, undefined, targetTemplate)

    expect(screen.queryByRole('heading', { level: 2, name: '空セクション' })).toBeNull()
    expect(document.querySelectorAll('[data-layout-mode]')).toHaveLength(1)
    const limitedSection = screen.getByRole('heading', { level: 2, name: '上限セクション' }).closest('section')
    expect(limitedSection?.querySelector('[data-field-over-limit]')?.textContent)
      .toBe('上限 5 を超えています（現在 55）')
  })

  it('blocks 未指定と空配列で既存 section DOM を byte-identical に保つ', () => {
    const blocklessTemplate = {
      ...template,
      sections: [{ ...template.sections[0], layout: { preset: 'stack' }, fields: [template.sections[0].fields[3]] }]
    }
    const { rerender } = renderForm({}, undefined, blocklessTemplate)
    const before = screen.getByRole('heading', { level: 2, name: 'プロフィール' }).closest('section')?.outerHTML
    const emptyBlocksTemplate = {
      ...blocklessTemplate,
      sections: blocklessTemplate.sections.map((section) => ({ ...section, blocks: [] }))
    }

    expect(before).toMatchInlineSnapshot(`"<section style="--stack-gap: var(--mantine-spacing-sm); --stack-align: stretch; --stack-justify: flex-start;" class="m_6d731127 mantine-Stack-root"><h2 style="--title-fw: var(--mantine-h2-font-weight); --title-lh: var(--mantine-h2-line-height); --title-fz: var(--mantine-h2-font-size);" class="m_8a5d1357 mantine-Title-root" data-order="2">プロフィール</h2><div class="fieldContainer" data-layout-mode="stack"><div data-field-uid="uid_hp"><div style="width: 100%;" class="m_1b7284a3 mantine-Paper-root" data-with-border="true" data-field-placeholder="track"><p style="font-weight: 600;" class="mantine-focus-auto m_b6d8b162 mantine-Text-root">耐久力</p><p style="--text-fz: var(--mantine-font-size-sm); --text-lh: var(--mantine-line-height-sm);" class="mantine-focus-auto m_b6d8b162 mantine-Text-root" data-size="sm">track</p></div></div></div></section>"`)

    rerender(
      <MantineProvider>
        <TemplateFormRenderer template={emptyBlocksTemplate} values={{}} />
      </MantineProvider>
    )

    expect(screen.getByRole('heading', { level: 2, name: 'プロフィール' }).closest('section')?.outerHTML).toBe(before)
  })

  it('status=ok の block cap を見出しの Badge に表示する', () => {
    const targetTemplate = createAnnotationTemplate({
      blocks: [{ id: 'combat', label: '戦闘技能', cap: 40 }],
      fields: [{ id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'text', blockId: 'combat' }]
    })

    renderForm({}, undefined, targetTemplate)

    expect(screen.getByRole('heading', { level: 3, name: '戦闘技能' })).toBeTruthy()
    expect(screen.getByText('上限 40').closest('[data-block-cap="40"]')).toBeTruthy()
  })

  it("origin='block' では見出し Badge と field 超過文言に同じ cap を表示する", () => {
    const targetTemplate = createAnnotationTemplate({
      blocks: [{ id: 'combat', label: '戦闘技能', cap: 40 }],
      fields: [{
        id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'number', blockId: 'combat'
      }]
    })
    const runtime = evaluateAnnotationRuntime(targetTemplate, { uid_skill: 55 })

    expect(runtime.sections[0].limits[0]).toMatchObject({ origin: 'block', status: 'ok', limit: 40, over: true })
    renderForm({ uid_skill: 55 }, undefined, targetTemplate)

    expect(screen.getByText('上限 40').closest('[data-block-cap="40"]')).toBeTruthy()
    expect(screen.getByText('上限 40 を超えています（現在 55）')).toBeTruthy()
  })

  it('重複 sectionId でも annotation を宣言 index で対応付ける', () => {
    const targetTemplate = {
      ...template,
      sections: [
        {
          id: 'same', label: '第一セクション', layout: { preset: 'stack' as const },
          blocks: [{ id: 'combat', label: '第一ブロック', cap: 10 }],
          fields: [{ id: 'first', uid: 'first', label: '第一値', type: 'scalar' as const, valueType: 'text' as const, blockId: 'combat' }]
        },
        {
          id: 'same', label: '第二セクション', layout: { preset: 'stack' as const },
          blocks: [{ id: 'combat', label: '第二ブロック', cap: 20 }],
          fields: [{ id: 'second', uid: 'second', label: '第二値', type: 'scalar' as const, valueType: 'text' as const, blockId: 'combat' }]
        }
      ]
    }

    renderForm({}, undefined, targetTemplate)

    const firstSection = screen.getByRole('heading', { level: 2, name: '第一セクション' }).closest('section')
    const secondSection = screen.getByRole('heading', { level: 2, name: '第二セクション' }).closest('section')
    expect(firstSection?.querySelector('[data-block-cap]')?.textContent).toBe('上限 10')
    expect(secondSection?.querySelector('[data-block-cap]')?.textContent).toBe('上限 20')
  })

  it('indeterminate / error の block cap は見出しに表示しない', () => {
    const targetTemplate = createAnnotationTemplate({
      blocks: [
        { id: 'pending', label: '未確定', cap: { formula: '{skills.base}' } },
        { id: 'broken', label: '評価失敗', cap: { formula: '1 / 0' } }
      ],
      fields: [
        { id: 'pending', uid: 'uid_pending', label: '未確定値', type: 'scalar', valueType: 'text', blockId: 'pending' },
        { id: 'broken', uid: 'uid_broken', label: '失敗値', type: 'scalar', valueType: 'text', blockId: 'broken' },
        { id: 'base', uid: 'uid_base', label: '参照元', type: 'scalar', valueType: 'number' }
      ]
    })

    renderForm({}, undefined, targetTemplate)

    expect(screen.getByRole('heading', { level: 3, name: '未確定' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: '評価失敗' })).toBeTruthy()
    expect(document.querySelector('[data-block-cap]')).toBeNull()
  })

  it('field-over-limit の実値を入力近傍に表示し、非超過 field では表示しない', () => {
    const targetTemplate = createAnnotationTemplate({
      fields: [
        { id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'number', max: 40 },
        { id: 'note', uid: 'uid_note', label: '注記', type: 'scalar', valueType: 'text' }
      ]
    })
    const { rerender } = renderForm({ uid_skill: 55 }, undefined, targetTemplate)

    const warning = screen.getByText('上限 40 を超えています（現在 55）')
    expect(getFieldCell('uid_skill').contains(warning)).toBe(true)
    expect(getFieldCell('uid_note').querySelector('[data-field-over-limit]')).toBeNull()

    rerender(
      <MantineProvider>
        <TemplateFormRenderer template={targetTemplate} values={{ uid_skill: 40 }} />
      </MantineProvider>
    )
    expect(screen.queryByText('上限 40 を超えています（現在 55）')).toBeNull()
    expect(document.querySelector('[data-field-over-limit]')).toBeNull()
  })

  it.each([
    ['P2: uid 値', ['same', 'same'], { dup: 55 }],
    ['P3: 重複 sectionId の canonical path 値', ['same', 'same'], { 'same.low': 55, 'same.high': 3 }],
    ['P4: 異なる sectionId の canonical path 値', ['first', 'second'], { 'first.low': 55, 'second.high': 3 }]
  ])('%s では各 section が自分の limit annotation だけを表示する', (_case, sectionIds, values) => {
    const targetTemplate: SheetTemplate = {
      ...template,
      sections: [
        {
          id: sectionIds[0], label: '上限 5 セクション', layout: { preset: 'stack' },
          fields: [{ id: 'low', uid: 'dup', label: '上限 5 値', type: 'scalar', valueType: 'number', max: 5 }]
        },
        {
          id: sectionIds[1], label: '上限 100 セクション', layout: { preset: 'stack' },
          fields: [{ id: 'high', uid: 'dup', label: '上限 100 値', type: 'scalar', valueType: 'number', max: 100 }]
        }
      ]
    }

    renderForm(values, undefined, targetTemplate)

    const lowSection = screen.getByRole('heading', { level: 2, name: '上限 5 セクション' }).closest('section')
    const highSection = screen.getByRole('heading', { level: 2, name: '上限 100 セクション' }).closest('section')
    expect(lowSection?.querySelector('[data-field-over-limit]')?.textContent).toBe('上限 5 を超えています（現在 55）')
    expect(highSection?.querySelector('[data-field-over-limit]')).toBeNull()
  })

  it.each([
    ['indeterminate', { formula: '{skills.base}' }],
    ['error', { formula: '1 / 0' }]
  ])('status=%s の field limit は表示しない', (_status, max) => {
    const targetTemplate = createAnnotationTemplate({
      fields: [
        { id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'number', max },
        { id: 'base', uid: 'uid_base', label: '参照元', type: 'scalar', valueType: 'number' }
      ]
    })

    renderForm({ uid_skill: 55 }, undefined, targetTemplate)

    expect(document.querySelector('[data-field-over-limit]')).toBeNull()
  })

  it('同一 section の重複 fieldUid では曖昧な上限文言を表示しない', () => {
    const targetTemplate = createAnnotationTemplate({
      fields: [
        { id: 'first', uid: 'dup', label: '上限 5', type: 'scalar', valueType: 'number', max: 5 },
        { id: 'second', uid: 'dup', label: '上限 10', type: 'scalar', valueType: 'number', max: 10 }
      ]
    })

    renderForm({ dup: 20 }, undefined, targetTemplate)

    expect(document.querySelector('[data-field-over-limit]')).toBeNull()
  })

  it('displayValue が省略された上限 annotation は undefined を含む文言を表示しない', () => {
    const targetTemplate = createAnnotationTemplate({
      fields: [{ id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'number', max: 5 }]
    })

    renderForm({ uid_skill: { parts: { career: 'invalid' } } }, undefined, targetTemplate)

    expect(document.querySelector('[data-field-over-limit]')).toBeNull()
    expect(document.body.textContent).not.toContain('undefined')
  })

  it('構造 skew の 6 warning code をフォーム DOM に表示しない', () => {
    const targetTemplate = createAnnotationTemplate({
      blocks: [{ id: 'dup', label: '先' }, { id: 'dup', label: '後' }],
      pools: [
        { id: 'pool', label: '予算', total: 10, partsKey: 'missing', scope: ['missing-block'] },
        { id: 'pool', label: '重複予算', total: 10, partsKey: 'missing' }
      ],
      fields: [
        {
          id: 'number', uid: 'number', label: '数値', type: 'scalar', valueType: 'number',
          partsKeys: [{ id: 'part', label: '先' }, { id: 'part', label: '後' }]
        },
        { id: 'missing', uid: 'missing', label: '不在参照', type: 'scalar', valueType: 'text', blockId: 'missing-block' }
      ]
    })
    const warningCodes = [
      'duplicate-block-id', 'duplicate-pool-id', 'duplicate-parts-key-id',
      'missing-field-block', 'missing-pool-scope-block', 'missing-pool-parts-key-declaration'
    ]

    expect(new Set(evaluateAnnotationRuntime(targetTemplate).warnings.map(({ code }) => code))).toEqual(new Set(warningCodes))
    renderForm({}, undefined, targetTemplate)

    warningCodes.forEach((code) => expect(document.body.innerHTML).not.toContain(code))
  })

  it('status=ok の pool を section 見出し直後にバーと残量で表示する', () => {
    const targetTemplate = createAnnotationTemplate({
      pools: [{ id: 'career', label: '職業ポイント', total: 10, partsKey: 'career' }]
    })

    renderForm({ uid_skill: { parts: { career: 3 } } }, undefined, targetTemplate)

    const section = screen.getByRole('heading', { level: 2, name: '技能' }).closest('section') as HTMLElement
    const pool = screen.getByText('職業ポイント').closest('[data-pool-id="career"]') as HTMLElement
    const progress = screen.getByRole('progressbar', { name: '職業ポイント の予算使用率' })
    expect(section.children[1].contains(pool)).toBe(true)
    expect(pool.dataset.poolStatus).toBe('ok')
    expect(progress.getAttribute('aria-valuenow')).toBe('30')
    expect(screen.getByText('残り 7 / 10')).toBeTruthy()
  })

  it('超過 pool のバーを danger 表現にして超過量を表示する', () => {
    const targetTemplate = createAnnotationTemplate({
      pools: [{ id: 'career', label: '職業ポイント', total: 10, partsKey: 'career' }]
    })

    renderForm({ uid_skill: { parts: { career: 12 } } }, undefined, targetTemplate)

    const pool = screen.getByText('職業ポイント').closest('[data-pool-id="career"]') as HTMLElement
    expect(pool.dataset.poolStatus).toBe('danger')
    expect(screen.getByRole('progressbar', { name: '職業ポイント の予算使用率' }).getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByText('超過 2')).toBeTruthy()
  })

  it.each([
    ['indeterminate', { formula: '{skills.base}' }],
    ['error', { formula: '1 / 0' }]
  ])('status=%s の pool は表示しない', (_status, total) => {
    const targetTemplate = createAnnotationTemplate({
      pools: [{ id: 'career', label: '職業ポイント', total, partsKey: 'career' }],
      fields: [
        ...createAnnotationTemplate().sections[0].fields,
        { id: 'base', uid: 'uid_base', label: '参照元', type: 'scalar', valueType: 'number' }
      ]
    })

    renderForm({}, undefined, targetTemplate)

    expect(screen.queryByText('職業ポイント')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('remaining が非有限で status=error へ退化した pool は表示しない', () => {
    const targetTemplate = createAnnotationTemplate({
      pools: [{ id: 'career', label: '職業ポイント', total: -Number.MAX_VALUE, partsKey: 'career' }]
    })
    const values = { uid_skill: { parts: { career: Number.MAX_VALUE } } }

    expect(evaluateAnnotationRuntime(targetTemplate, values).sections[0].pools[0]).toMatchObject({ status: 'error' })
    renderForm(values, undefined, targetTemplate)

    expect(screen.queryByText('職業ポイント')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('宣言ブロック内の text scalar を values で制御して uid と変更値を通知する', () => {
    const onChange = jest.fn()
    const targetTemplate = createBlockedTemplate({ preset: 'stack' })
    const { rerender } = renderForm({ uid_stat_1: 'STR 12' }, onChange, targetTemplate)

    const input = screen.getByRole('textbox', { name: '能力値 1' }) as HTMLInputElement
    expect(input.value).toBe('STR 12')

    fireEvent.change(input, { target: { value: 'STR 13' } })
    expect(onChange).toHaveBeenCalledWith('uid_stat_1', 'STR 13')

    rerender(
      <MantineProvider>
        <TemplateFormRenderer template={targetTemplate} values={{ uid_stat_1: 'STR 14' }} onChange={onChange} />
      </MantineProvider>
    )
    expect(input.value).toBe('STR 14')
  })

  it('table preset の単純 field を宣言順の固定 2 列・1 field 1 行で描画する', () => {
    renderForm({ uid_score: 42 }, undefined, createTableTemplate())

    const fieldContainer = getFieldContainer('テーブル')
    const tableElement = fieldContainer.querySelector('table') as HTMLTableElement
    expect(fieldContainer.classList.contains(styles.fieldContainer)).toBe(true)
    expect(fieldContainer.dataset.layoutMode).toBe('table')
    expect(fieldContainer.dataset.gridColumns).toBeUndefined()
    expect(tableElement).toBeTruthy()
    expect(tableElement.parentElement?.classList.contains(styles.tableScroll)).toBe(true)
    expect(Array.from(tableElement.rows).map((row) => row.dataset.fieldUid)).toEqual(
      template.sections[0].fields.map((field) => field.uid)
    )

    const simpleRows = [
      ['uid_name', '名前'],
      ['uid_score', '算出値'],
      ['uid_check', '判定']
    ]
    simpleRows.forEach(([fieldUid, label]) => {
      const matchingRows = tableElement.querySelectorAll(`[data-field-uid="${fieldUid}"]`)
      const row = matchingRows[0] as HTMLTableRowElement
      expect(matchingRows).toHaveLength(1)
      expect(row.tagName).toBe('TR')
      expect(row.dataset.tableRowMode).toBe('columns')
      expect(row.cells).toHaveLength(2)
      expect(row.cells[0].tagName).toBe('TH')
      expect(row.cells[0].scope).toBe('row')
      expect(row.cells[0].dataset.tableColumn).toBe('label')
      expect(row.cells[0].textContent).toBe(label)
      expect(row.cells[1].tagName).toBe('TD')
      expect(row.cells[1].dataset.tableColumn).toBe('value')
    })
  })

  it('table の partsKeys を first-seen union で列展開し、未宣言セルと engine 合計を分離する', () => {
    const fields: SheetField[] = [
      {
        id: 'first', uid: 'uid_first', label: '技能 A', type: 'scalar', valueType: 'number',
        partsKeys: [{ id: 'career', label: '職業' }, { id: 'hobby', label: '趣味' }]
      },
      {
        id: 'second', uid: 'uid_second', label: '技能 B', type: 'scalar', valueType: 'number',
        partsKeys: [{ id: 'hobby', label: '趣味（後勝ち禁止）' }, { id: 'focus', label: '集中' }]
      },
      { id: 'note', uid: 'uid_note', label: '備考', type: 'scalar', valueType: 'text' }
    ]
    renderForm({
      uid_first: { parts: { career: 20, hobby: 10, base: 5 } },
      uid_second: { parts: { hobby: 4, focus: 3 } }
    }, undefined, createTableTemplate(fields))

    const tableElement = getFieldContainer('テーブル').querySelector('table') as HTMLTableElement
    const headers = Array.from(tableElement.tHead?.rows[0]?.cells ?? [])
    expect(headers.map((cell) => cell.textContent)).toEqual(['項目', '職業', '趣味', '集中', '合計'])
    expect(headers.map((cell) => cell.dataset.partsKey)).toEqual([undefined, 'career', 'hobby', 'focus', undefined])

    const firstRow = getFieldCell('uid_first') as HTMLTableRowElement
    const undeclaredCell = firstRow.querySelector('[data-parts-key="focus"]') as HTMLTableCellElement
    expect(undeclaredCell.dataset.partsDeclared).toBe('false')
    expect(undeclaredCell.textContent).toBe('')
    expect(firstRow.cells[4].dataset.tableColumn).toBe('total')
    expect(firstRow.cells[4].textContent).toBe('35')
    expect(20 + 10).not.toBe(35)

    const noteRow = getFieldCell('uid_note') as HTMLTableRowElement
    expect(noteRow.dataset.tableRowMode).toBe('columns')
    expect(noteRow.cells[1].dataset.tableColumn).toBe('value')
    expect(noteRow.cells[1].colSpan).toBe(4)
  })

  it('table の parts 列は text scalar の draft partsKeys を union へ混ぜない', () => {
    const fields: SheetField[] = [
      {
        id: 'skill', uid: 'uid_skill', label: '技能', type: 'scalar', valueType: 'number',
        partsKeys: [{ id: 'career', label: '職業' }]
      },
      {
        id: 'note', uid: 'uid_note', label: '備考', type: 'scalar', valueType: 'text',
        partsKeys: [{ id: 'hobby', label: '趣味' }]
      }
    ]

    renderForm({}, undefined, createTableTemplate(fields))

    const tableElement = getFieldContainer('テーブル').querySelector('table') as HTMLTableElement
    expect(Array.from(tableElement.querySelectorAll<HTMLElement>('thead [data-parts-key]'))
      .map(({ dataset }) => dataset.partsKey)).toEqual(['career'])
  })

  it('table の parts:true と partsKeys が併存しても union を空に保ち、2 列の合計行へ縮退する', () => {
    const targetTemplate = createTableTemplate([{
      id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true,
      partsKeys: [{ id: 'career', label: '職業' }]
    }])
    renderForm({ uid_free: { parts: { career: 8 } } }, undefined, targetTemplate)

    const tableElement = getFieldContainer('テーブル').querySelector('table') as HTMLTableElement
    const freeRow = getFieldCell('uid_free') as HTMLTableRowElement
    expect(tableElement.tHead).toBeNull()
    expect(freeRow.dataset.tableRowMode).toBe('parts-total')
    expect(freeRow.cells).toHaveLength(2)
    expect(freeRow.querySelector('[data-table-column="total"]')?.textContent).toBe('8')
    expect(freeRow.querySelector('input')).toBeNull()
  })

  it('table の parts:true 併存 field を除外し、正常宣言 field だけで union を作る', () => {
    const fields: SheetField[] = [
      {
        id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true,
        partsKeys: [{ id: 'career', label: '職業' }]
      },
      {
        id: 'declared', uid: 'uid_declared', label: '宣言型', type: 'scalar', valueType: 'number',
        partsKeys: [{ id: 'hobby', label: '趣味' }]
      }
    ]
    renderForm({}, undefined, createTableTemplate(fields))

    const tableElement = getFieldContainer('テーブル').querySelector('table') as HTMLTableElement
    expect(Array.from(tableElement.querySelectorAll('thead [data-parts-key]'))
      .map((header) => (header as HTMLElement).dataset.partsKey)).toEqual(['hobby'])
    expect(getFieldCell('uid_free').querySelector('[data-parts-key="career"]')).toBeNull()
    expect(getFieldCell('uid_free').dataset.tableRowMode).toBe('parts-total')
  })

  it('table の空 partsKeys も列数に依存せず field 単位の parts 行として描画する', () => {
    const targetTemplate = createTableTemplate([{
      id: 'empty', uid: 'uid_empty', label: '空宣言', type: 'scalar', valueType: 'number', partsKeys: []
    }])

    renderForm({}, jest.fn(), targetTemplate, jest.fn())

    const row = getFieldCell('uid_empty') as HTMLTableRowElement
    expect(row.dataset.tableRowMode).toBe('parts')
    expect(row.cells).toHaveLength(2)
    expect(row.querySelector('input')).toBeNull()
    expect(row.querySelector('[data-table-column="total"]')?.textContent).toBe('')
  })

  it('table 合計は raw parts を再合算せず annotation runtime の sentinel を表示する', () => {
    const targetTemplate = createTableTemplate([{
      id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'number',
      partsKeys: [{ id: 'career', label: '職業' }, { id: 'hobby', label: '趣味' }, { id: 'base', label: '基礎' }]
    }])
    const runtimeRaw = { parts: { career: 42 } }
    const rendererRaw = { parts: { career: 20, hobby: 10, base: 5 } }
    const values = createDisplayValueSentinel('uid_skill', runtimeRaw, rendererRaw)

    expect(evaluateAnnotationRuntime(targetTemplate, { uid_skill: runtimeRaw })
      .sections[0].fieldBlocks[0].displayValue).toBe(42)
    renderForm(values, undefined, targetTemplate)

    const total = getFieldCell('uid_skill').querySelector('[data-table-column="total"]') as HTMLElement
    expect(Object.values(rendererRaw.parts).reduce((sum, value) => sum + value, 0)).toBe(35)
    expect(total.textContent).toBe('42')
    expect(total.textContent).not.toBe('35')
  })

  it('table の宣言キー入力は有限数だけを per-key callback へ通知する', () => {
    const onChange = jest.fn()
    const onPartsChange = jest.fn()
    const targetTemplate = createTableTemplate([{
      id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'number',
      partsKeys: [{ id: 'career', label: '職業' }]
    }])
    renderForm({ uid_skill: { parts: { career: 2 } } }, onChange, targetTemplate, onPartsChange)

    const input = screen.getByRole('textbox', { name: '技能値: 職業' }) as HTMLInputElement
    expect(input.value).toBe('2')
    fireEvent.change(input, { target: { value: '-4' } })
    fireEvent.change(input, { target: { value: '0' } })
    for (const value of ['', '-', '1.']) fireEvent.change(input, { target: { value } })

    expect(onPartsChange).toHaveBeenNthCalledWith(1, 'uid_skill', 'career', -4)
    expect(onPartsChange).toHaveBeenNthCalledWith(2, 'uid_skill', 'career', 0)
    expect(onPartsChange).toHaveBeenCalledTimes(2)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('B12-FIX 前の reserved / UNSAFE 宣言キーを table 列と宣言型 Popover 行に提示しない', async () => {
    const partsKeys = [
      { id: '__proto__', label: '危険キー' },
      { id: 'base', label: '予約キー' },
      { id: 'career', label: '職業' }
    ]
    const targetTemplate: SheetTemplate = {
      ...template,
      sections: [
        {
          id: 'table-defense',
          label: 'テーブル防御',
          layout: { preset: 'table' },
          fields: [{
            id: 'table-skill', uid: 'uid_table_skill', label: 'テーブル技能', type: 'scalar', valueType: 'number',
            partsKeys
          }]
        },
        {
          id: 'popover-defense',
          label: 'Popover 防御',
          layout: { preset: 'stack' },
          fields: [{
            id: 'popover-skill', uid: 'uid_popover_skill', label: 'Popover 技能', type: 'scalar', valueType: 'number',
            partsKeys
          }]
        }
      ]
    }

    // 旧公開データが残っても、一般の列・行列挙だけを閉じて専用 base 行を維持する境界を固定する。
    renderForm({}, undefined, targetTemplate, jest.fn())

    const tablePartKeys = Array.from(document.querySelectorAll<HTMLElement>('thead [data-parts-key]'))
      .map((header) => header.dataset.partsKey)
    expect(tablePartKeys).toEqual(['career'])

    fireEvent.click(screen.getByRole('button', { name: 'Popover 技能: 内訳を編集' }))
    const baseInput = await screen.findByRole('textbox', { name: 'Popover 技能: base' })
    const popover = document.querySelector('[data-parts-popover="uid_popover_skill"]') as HTMLElement
    expect(Array.from(popover.querySelectorAll<HTMLInputElement>('input')).map((input) => input.getAttribute('aria-label')))
      .toEqual(['Popover 技能: base', 'Popover 技能: 職業'])
    expect(baseInput).toBeTruthy()
    expect(popover.querySelector('[data-parts-key="__proto__"]')).toBeNull()
    expect(popover.querySelector('[data-parts-key="base"]')).toBe(baseInput)
  })

  it('table の parts:true は canonical キーを編集せず engine 合計だけを表示する', () => {
    const fields: SheetField[] = [
      {
        id: 'declared', uid: 'uid_declared', label: '宣言型', type: 'scalar', valueType: 'number',
        partsKeys: [{ id: 'career', label: '職業' }]
      },
      { id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true }
    ]
    renderForm({ uid_free: { parts: { custom: 8 } } }, undefined, createTableTemplate(fields))

    const freeRow = getFieldCell('uid_free') as HTMLTableRowElement
    expect(freeRow.dataset.tableRowMode).toBe('parts-total')
    expect(freeRow.querySelector('[data-parts-key="career"]')?.textContent).toBe('')
    expect(freeRow.querySelector('input')).toBeNull()
    expect(freeRow.querySelector('[data-table-column="total"]')?.textContent).toBe('8')
  })

  it('table の parts:true 合計セルから grid と共通の Popover を開く', async () => {
    const targetTemplate = createTableTemplate([{
      id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true
    }])
    renderForm({ uid_free: { parts: { custom: 8, base: 2 } } }, undefined, targetTemplate, jest.fn())

    const freeRow = getFieldCell('uid_free') as HTMLTableRowElement
    const trigger = screen.getByRole('button', { name: '自由型: 内訳を編集' })
    expect(freeRow.querySelector('[data-table-column="total"]')?.textContent).toBe('10')
    expect(freeRow.querySelector('input')).toBeNull()

    fireEvent.click(trigger)

    const baseInput = await screen.findByRole('textbox', { name: '自由型: base' }) as HTMLInputElement
    const popover = document.querySelector('[data-parts-popover="uid_free"]') as HTMLElement
    const customInput = popover.querySelector('input[aria-label="自由型: custom"]') as HTMLInputElement
    expect(popover).toBeTruthy()
    expect(baseInput.value).toBe('2')
    expect(customInput.value).toBe('8')
    expect(freeRow.querySelector('[data-parts-popover="uid_free"]')).toBe(popover)
  })

  it('table の canonical union をブロックごとに分離する', () => {
    const targetTemplate = createTableTemplate([
      {
        id: 'block-a', uid: 'uid_block_a', label: 'A', type: 'scalar', valueType: 'number', blockId: 'a',
        partsKeys: [{ id: 'career', label: '職業' }]
      },
      {
        id: 'block-b', uid: 'uid_block_b', label: 'B', type: 'scalar', valueType: 'number', blockId: 'b',
        partsKeys: [{ id: 'hobby', label: '趣味' }]
      }
    ])
    targetTemplate.sections[0].blocks = [{ id: 'a', label: 'A block' }, { id: 'b', label: 'B block' }]

    renderForm({}, undefined, targetTemplate)

    const tables = Array.from(document.querySelectorAll('table'))
    expect(tables.map((table) => Array.from(table.querySelectorAll('thead [data-parts-key]'))
      .map((header) => (header as HTMLElement).dataset.partsKey))).toEqual([['career'], ['hobby']])
  })

  it('table の displayValue 省略時は合計セルを空表示にする', () => {
    const targetTemplate = createTableTemplate([{
      id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'number',
      partsKeys: [{ id: 'career', label: '職業' }]
    }])
    renderForm({ uid_skill: { parts: { career: 'invalid' } } }, undefined, targetTemplate)

    const total = getFieldCell('uid_skill').querySelector('[data-table-column="total"]') as HTMLElement
    expect(total.textContent).toBe('')
    expect(document.body.textContent).not.toContain('undefined')
  })

  it.each([
    ['track', 'uid_hp'],
    ['list', 'uid_items'],
    ['relation', 'uid_bond'],
    ['tag', 'uid_tags']
  ])('%s を table の全幅行 placeholder として描画する', (fieldType, fieldUid) => {
    renderForm({}, undefined, createTableTemplate())

    const row = getFieldCell(fieldUid) as HTMLTableRowElement
    const cell = row.cells[0]
    expect(row.tagName).toBe('TR')
    expect(row.dataset.tableRowMode).toBe('full-width')
    expect(row.cells).toHaveLength(1)
    expect(cell.tagName).toBe('TD')
    expect(cell.colSpan).toBe(2)
    expect(cell.querySelector(`[data-field-placeholder="${fieldType}"]`)).toBeTruthy()
  })

  it('table の値列でも controlled 入力を values で制御し、uid と変更値を通知する', () => {
    const onChange = jest.fn()
    const targetTemplate = createTableTemplate([template.sections[0].fields[0]])
    const { rerender } = renderForm({ uid_name: '継続探索者' }, onChange, targetTemplate)

    const row = getFieldCell('uid_name') as HTMLTableRowElement
    const input = screen.getByRole('textbox', { name: '名前' }) as HTMLInputElement
    expect(row.cells[1].dataset.tableColumn).toBe('value')
    expect(row.cells[1].contains(input)).toBe(true)
    expect(input.value).toBe('継続探索者')

    fireEvent.change(input, { target: { value: '新規探索者' } })
    expect(onChange).toHaveBeenCalledWith('uid_name', '新規探索者')

    rerender(
      <MantineProvider>
        <TemplateFormRenderer
          template={targetTemplate}
          values={{ uid_name: '更新済み探索者' }}
          onChange={onChange}
        />
      </MantineProvider>
    )
    expect(input.value).toBe('更新済み探索者')
  })

  it('table の number / boolean / select 入力を行見出しで命名する', () => {
    const fields: SheetField[] = [
      { id: 'number', uid: 'uid_number', label: '能力値', type: 'scalar', valueType: 'number' },
      { id: 'boolean', uid: 'uid_boolean', label: '生存', type: 'scalar', valueType: 'boolean' },
      {
        id: 'select', uid: 'uid_select', label: '職業', type: 'scalar', valueType: 'select',
        options: [{ label: '探偵', value: 'detective' }]
      }
    ]

    renderForm({}, undefined, createTableTemplate(fields))

    const controls = [
      ['uid_number', 'textbox', '能力値'],
      ['uid_boolean', 'checkbox', '生存'],
      ['uid_select', 'combobox', '職業']
    ] as const

    controls.forEach(([fieldUid, role, name]) => {
      const row = getFieldCell(fieldUid) as HTMLTableRowElement
      const control = screen.getByRole(role, { name })
      expect(control.getAttribute('aria-labelledby')).toBe(row.cells[0].id)
    })
  })

  it('select の選択肢を再クリックして deselect しても null を通知しない', async () => {
    // Mantine Combobox が選択肢を開く際に呼ぶ browser API を、この操作 spec に限って補う。
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() })
    const onChange = jest.fn()
    const targetTemplate = createAnnotationTemplate({
      fields: [{
        id: 'role', uid: 'uid_role', label: '職業', type: 'scalar', valueType: 'select',
        options: [{ label: '探偵', value: 'detective' }]
      }]
    })
    renderForm({ uid_role: 'detective' }, onChange, targetTemplate)

    fireEvent.click(screen.getByRole('combobox', { name: '職業' }))
    fireEvent.click(await screen.findByRole('option', { name: '探偵' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('publish が受理する空白入り uid でも table の値列を行見出しで取得できる', () => {
    const fieldUid = 'uid with space'
    const targetTemplate = createTableTemplate([{ ...template.sections[0].fields[0], uid: fieldUid }])

    expect(validatePublishTemplate(targetTemplate).ok).toBe(true)

    renderForm({ [fieldUid]: '継続探索者' }, undefined, targetTemplate)

    expect(screen.getByRole('textbox', { name: '名前' })).toBeTruthy()
  })

  it('columns 省略時は engine 正本の既定列数で grid 描画する', () => {
    const targetTemplate = {
      ...template,
      sections: [{ ...template.sections[0], label: '既定 grid', layout: { preset: 'grid' } }]
    }

    renderForm({}, undefined, targetTemplate)

    const grid = getFieldContainer('既定 grid')
    expect(grid.classList.contains(styles.fieldContainer)).toBe(true)
    expect(grid.dataset.gridColumns).toBe(String(DEFAULT_SHEET_SECTION_GRID_COLUMNS))
  })

  it('grid の parts 宣言 field は raw を再合算せず displayValue の sentinel だけを表示する', () => {
    const targetTemplate = createAnnotationTemplate({
      layout: { preset: 'grid', columns: 2 },
      fields: [{
        id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'number',
        partsKeys: [{ id: 'career', label: '職業' }, { id: 'hobby', label: '趣味' }]
      }]
    })
    const runtimeRaw = { parts: { career: 42 } }
    const rendererRaw = { parts: { career: 20, hobby: 10, base: 5 } }
    const values = createDisplayValueSentinel('uid_skill', runtimeRaw, rendererRaw)

    const { rerender } = renderForm(values, jest.fn(), targetTemplate, jest.fn())

    const cell = getFieldCell('uid_skill')
    const trigger = screen.getByRole('button', { name: '技能値: 内訳を編集' })
    expect(cell.querySelector('input')).toBeNull()
    expect(trigger.querySelector('[data-field-display-value="uid_skill"]')?.textContent).toBe('42')
    expect(Object.values(rendererRaw.parts).reduce((sum, value) => sum + value, 0)).toBe(35)
    expect(trigger.textContent).not.toBe('35')

    rerender(
      <MantineProvider>
        <TemplateFormRenderer template={targetTemplate} values={{ uid_skill: { parts: { career: 'invalid' } } }} />
      </MantineProvider>
    )
    expect(screen.getByRole('button', { name: '技能値: 内訳を編集' }).textContent).toBe('')
  })

  it('grid Popover の base と宣言キーは有限数だけを per-key callback へ通知する', async () => {
    const onChange = jest.fn()
    const onPartsChange = jest.fn()
    const targetTemplate = createAnnotationTemplate({
      layout: { preset: 'grid', columns: 2 },
      fields: [{
        id: 'skill', uid: 'uid_skill', label: '技能値', type: 'scalar', valueType: 'number',
        partsKeys: [{ id: 'career', label: '職業' }, { id: 'hobby', label: '趣味' }]
      }]
    })
    renderForm({
      uid_skill: { parts: { base: 3, career: 2, hobby: 1 } }
    }, onChange, targetTemplate, onPartsChange)

    const trigger = screen.getByRole('button', { name: '技能値: 内訳を編集' })
    expect(screen.queryByRole('textbox', { name: '技能値: base' })).toBeNull()
    fireEvent.focus(trigger)

    const baseInput = await screen.findByRole('textbox', { name: '技能値: base' }) as HTMLInputElement
    const popover = document.querySelector('[data-parts-popover="uid_skill"]') as HTMLElement
    const careerInput = popover.querySelector('input[aria-label="技能値: 職業"]') as HTMLInputElement
    const hobbyInput = popover.querySelector('input[aria-label="技能値: 趣味"]') as HTMLInputElement
    expect([baseInput.value, careerInput.value, hobbyInput.value]).toEqual(['3', '2', '1'])

    fireEvent.change(baseInput, { target: { value: '-4' } })
    fireEvent.change(careerInput, { target: { value: '0' } })
    for (const value of ['', '-', '1.']) fireEvent.change(baseInput, { target: { value } })

    expect(onPartsChange).toHaveBeenNthCalledWith(1, 'uid_skill', 'base', -4)
    expect(onPartsChange).toHaveBeenNthCalledWith(2, 'uid_skill', 'career', 0)
    expect(onPartsChange).toHaveBeenCalledTimes(2)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('grid Popover は Tab 順を内訳へ接続し、trigger の Enter・Space・Escape で開閉する', async () => {
    const targetTemplate = createAnnotationTemplate({
      layout: { preset: 'grid', columns: 2 },
      fields: [
        { id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true },
        { id: 'note', uid: 'uid_note', label: '備考', type: 'scalar', valueType: 'text' }
      ]
    })
    renderForm({ uid_free: { parts: { base: 1 } } }, undefined, targetTemplate, jest.fn())

    const trigger = screen.getByRole('button', { name: '自由型: 内訳を編集' })
    const noteInput = screen.getByRole('textbox', { name: '備考' })
    act(() => trigger.focus())
    const baseInput = await screen.findByRole('textbox', { name: '自由型: base' })

    fireEvent.keyDown(trigger, { key: 'Tab' })
    moveFocusByDomOrder(trigger, 1)
    expect(document.activeElement).toBe(baseInput)
    fireEvent.keyDown(baseInput, { key: 'Tab', shiftKey: true })
    moveFocusByDomOrder(baseInput, -1)
    expect(document.activeElement).toBe(trigger)
    expect(baseInput.compareDocumentPosition(noteInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    for (const key of ['Enter', ' ']) {
      fireEvent.keyDown(trigger, { key })
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      fireEvent.keyDown(trigger, { key })
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    }
  })

  it('stack Popover は Tab 順を内訳へ接続し、trigger の Enter・Space・Escape で開閉する', async () => {
    const targetTemplate = createAnnotationTemplate({
      fields: [
        { id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true },
        { id: 'note', uid: 'uid_note', label: '備考', type: 'scalar', valueType: 'text' }
      ]
    })
    renderForm({ uid_free: { parts: { base: 1 } } }, undefined, targetTemplate, jest.fn())

    const trigger = screen.getByRole('button', { name: '自由型: 内訳を編集' })
    const noteInput = screen.getByRole('textbox', { name: '備考' })
    act(() => trigger.focus())
    const baseInput = await screen.findByRole('textbox', { name: '自由型: base' })

    fireEvent.keyDown(trigger, { key: 'Tab' })
    moveFocusByDomOrder(trigger, 1)
    expect(document.activeElement).toBe(baseInput)
    fireEvent.keyDown(baseInput, { key: 'Tab', shiftKey: true })
    moveFocusByDomOrder(baseInput, -1)
    expect(document.activeElement).toBe(trigger)
    expect(baseInput.compareDocumentPosition(noteInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    for (const key of ['Enter', ' ']) {
      fireEvent.keyDown(trigger, { key })
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      fireEvent.keyDown(trigger, { key })
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    }
  })

  it('parts:true Popover は base と raw 既存キーだけを出現順で列挙し、other を表示専用にする', async () => {
    const targetTemplate = createAnnotationTemplate({
      layout: { preset: 'grid', columns: 2 },
      fields: [{
        id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true
      }]
    })
    const { rerender } = renderForm({
      uid_free: { parts: { second: 2, base: 1, other: 7, first: -1 } }
    }, undefined, targetTemplate, jest.fn())

    fireEvent.click(screen.getByRole('button', { name: '自由型: 内訳を編集' }))

    await screen.findByRole('textbox', { name: '自由型: base' })
    const popover = document.querySelector('[data-parts-popover="uid_free"]') as HTMLElement
    expect(Array.from(popover.querySelectorAll('input')).map((input) => input.getAttribute('aria-label'))).toEqual([
      '自由型: base',
      '自由型: second',
      '自由型: first'
    ])
    const otherRow = popover.querySelector('[data-parts-key="other"][data-parts-readonly="true"]') as HTMLElement
    expect(otherRow.querySelector('input')).toBeNull()
    expect(otherRow.querySelector('[data-parts-value="other"]')?.textContent).toBe('7')
    expect(screen.queryByRole('button', { name: /追加/ })).toBeNull()

    rerender(
      <MantineProvider>
        <TemplateFormRenderer template={targetTemplate} values={{ uid_free: { parts: { second: 9, base: 6 } } }} />
      </MantineProvider>
    )
    const updatedInputs = Array.from(popover.querySelectorAll<HTMLInputElement>('input'))
    expect(updatedInputs.map((input) => input.value)).toEqual(['6', '9'])
    expect(document.querySelector('[data-parts-key="other"][data-parts-readonly="true"]')).toBeNull()
  })

  it('parts:true Popover は unsafe な JSON own-key を除外し、非数値を空表示のまま通知できる', async () => {
    const onPartsChange = jest.fn()
    const targetTemplate = createAnnotationTemplate({
      layout: { preset: 'grid', columns: 2 },
      fields: [{
        id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true
      }]
    })
    const value = JSON.parse('{"parts":{"__proto__":4,"constructor":5,"prototype":6,"invalid":"x"}}') as unknown

    expect(() => renderForm({ uid_free: value }, undefined, targetTemplate, onPartsChange)).not.toThrow()
    fireEvent.click(screen.getByRole('button', { name: '自由型: 内訳を編集' }))

    const baseInput = await screen.findByRole('textbox', { name: '自由型: base' })
    const popover = document.querySelector('[data-parts-popover="uid_free"]') as HTMLElement
    const inputs = Array.from(popover.querySelectorAll<HTMLInputElement>('input'))
    expect(inputs.map((input) => input.getAttribute('aria-label'))).toEqual(['自由型: base', '自由型: invalid'])
    expect(inputs.map((input) => input.value)).toEqual(['', ''])

    fireEvent.change(baseInput, { target: { value: '6' } })
    fireEvent.change(inputs[1], { target: { value: '7' } })
    expect(onPartsChange).toHaveBeenNthCalledWith(1, 'uid_free', 'base', 6)
    expect(onPartsChange).toHaveBeenNthCalledWith(2, 'uid_free', 'invalid', 7)
  })

  it('partsKeys に予約 base を含む draft でも Popover の base 行を 1 本だけ描画する', async () => {
    const targetTemplate = createAnnotationTemplate({
      fields: [{
        id: 'declared', uid: 'uid_declared', label: '宣言型', type: 'scalar', valueType: 'number',
        partsKeys: [{ id: 'base', label: '基礎' }, { id: 'career', label: '職業' }]
      }]
    })
    renderForm({ uid_declared: { parts: { base: 2, career: 3 } } }, undefined, targetTemplate, jest.fn())

    fireEvent.click(screen.getByRole('button', { name: '宣言型: 内訳を編集' }))

    await screen.findByRole('textbox', { name: '宣言型: base' })
    const popover = document.querySelector('[data-parts-popover="uid_declared"]') as HTMLElement
    expect(Array.from(popover.querySelectorAll('input')).map((input) => input.getAttribute('aria-label'))).toEqual([
      '宣言型: base', '宣言型: 職業'
    ])
  })

  it('grid の非parts number scalar は有限数だけを plain onChange 経路へ通知する', () => {
    const onChange = jest.fn()
    const onPartsChange = jest.fn()
    const targetTemplate = createAnnotationTemplate({
      layout: { preset: 'grid', columns: 2 },
      fields: [{ id: 'plain', uid: 'uid_plain', label: '単純数値', type: 'scalar', valueType: 'number' }]
    })
    renderForm({ uid_plain: 2 }, onChange, targetTemplate, onPartsChange)

    const input = screen.getByRole('textbox', { name: '単純数値' }) as HTMLInputElement
    expect(input.value).toBe('2')
    expect(getFieldCell('uid_plain').querySelector('[data-parts-popover-trigger]')).toBeNull()
    fireEvent.change(input, { target: { value: '6' } })
    for (const value of ['', '-', '1.']) fireEvent.change(input, { target: { value } })
    expect(onChange).toHaveBeenCalledWith('uid_plain', 6)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onPartsChange).not.toHaveBeenCalled()
  })

  it('stack の非parts number scalar は有限数だけを plain onChange 経路へ通知する', () => {
    const onChange = jest.fn()
    const targetTemplate = createAnnotationTemplate({
      fields: [{ id: 'plain', uid: 'uid_plain', label: '単純数値', type: 'scalar', valueType: 'number' }]
    })
    renderForm({ uid_plain: 2 }, onChange, targetTemplate)

    const input = screen.getByRole('textbox', { name: '単純数値' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '-4' } })
    for (const value of ['', '-', '1.']) fireEvent.change(input, { target: { value } })

    expect(onChange).toHaveBeenCalledWith('uid_plain', -4)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('stack の parts 宣言 field を合計と per-key Popover で描画し whole-field を通知しない', async () => {
    const onChange = jest.fn()
    const onPartsChange = jest.fn()
    const targetTemplate = createAnnotationTemplate({
      fields: [
        {
          id: 'declared', uid: 'uid_declared', label: '宣言型', type: 'scalar', valueType: 'number',
          partsKeys: [{ id: 'career', label: '職業' }]
        },
        { id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true }
      ]
    })
    renderForm({
      uid_declared: { parts: { base: 2, career: 3 } },
      uid_free: { parts: { base: 4, custom: 5 } }
    }, onChange, targetTemplate, onPartsChange)

    const declaredTrigger = screen.getByRole('button', { name: '宣言型: 内訳を編集' })
    const freeTrigger = screen.getByRole('button', { name: '自由型: 内訳を編集' })
    expect(declaredTrigger.textContent).toBe('5')
    expect(freeTrigger.textContent).toBe('9')
    expect(screen.queryByRole('textbox', { name: '宣言型' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: '自由型' })).toBeNull()

    fireEvent.click(declaredTrigger)
    const careerInput = await screen.findByRole('textbox', { name: '宣言型: 職業' })
    fireEvent.change(careerInput, { target: { value: '6' } })
    fireEvent.click(freeTrigger)
    const customInput = await screen.findByRole('textbox', { name: '自由型: custom' })
    fireEvent.change(customInput, { target: { value: '7' } })

    expect(onPartsChange).toHaveBeenNthCalledWith(1, 'uid_declared', 'career', 6)
    expect(onPartsChange).toHaveBeenNthCalledWith(2, 'uid_free', 'custom', 7)
    expect(onPartsChange).toHaveBeenCalledTimes(2)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stack の parts:true と partsKeys 併存 draft は raw キーを優先して Popover から通知する', async () => {
    const onPartsChange = jest.fn()
    const targetTemplate = createAnnotationTemplate({
      fields: [{
        id: 'free', uid: 'uid_free', label: '自由型', type: 'scalar', valueType: 'number', parts: true,
        partsKeys: [{ id: 'career', label: '職業' }]
      }]
    })
    renderForm({ uid_free: { parts: { custom: 8 } } }, undefined, targetTemplate, onPartsChange)

    fireEvent.click(screen.getByRole('button', { name: '自由型: 内訳を編集' }))

    await screen.findByRole('textbox', { name: '自由型: base' })
    const popover = document.querySelector('[data-parts-popover="uid_free"]') as HTMLElement
    const customInput = popover.querySelector('input[aria-label="自由型: custom"]') as HTMLInputElement
    expect(Array.from(popover.querySelectorAll('input')).map((input) => input.getAttribute('aria-label'))).toEqual([
      '自由型: base', '自由型: custom'
    ])
    expect(popover.querySelector('input[aria-label="自由型: 職業"]')).toBeNull()
    fireEvent.change(customInput, { target: { value: '9' } })
    expect(onPartsChange).toHaveBeenCalledWith('uid_free', 'custom', 9)
  })

  it.each([2, 3] as const)('span %s が columns 以上なら全幅へ clamp する', (span) => {
    const targetTemplate = {
      ...template,
      sections: [{
        ...template.sections[0],
        layout: { preset: 'grid', columns: 2 },
        fields: [{
          id: 'clamped',
          uid: 'uid_clamped',
          label: 'clamp 対象',
          type: 'scalar' as const,
          valueType: 'text' as const,
          layout: { span }
        }]
      }]
    }

    renderForm({}, undefined, targetTemplate)

    const cell = getFieldCell('uid_clamped')
    expect(cell.dataset.gridSpan).toBe('full')
    expect(cell.classList.contains(styles.gridField)).toBe(true)
  })

  it.each([0, 4, 'wide'])('不正 span %s を engine 正本の既定幅として扱う', (span) => {
    const targetTemplate = {
      ...template,
      sections: [{
        ...template.sections[0],
        fields: [{
          id: 'invalid-span',
          uid: 'uid_invalid_span',
          label: '不正 span',
          type: 'scalar',
          valueType: 'text',
          layout: { span }
        }]
      }]
    } as unknown as SheetTemplate

    renderForm({}, undefined, targetTemplate)

    const cell = getFieldCell('uid_invalid_span')
    expect(cell.dataset.gridSpan).toBe(String(DEFAULT_SHEET_FIELD_LAYOUT_SPAN))
    expect(cell.classList.contains(styles.gridField)).toBe(true)
  })

  it('scalar 入力を values で制御して uid と変更値を通知する', () => {
    const onChange = jest.fn()
    const { rerender } = renderForm({ uid_name: '継続探索者' }, onChange)

    const input = screen.getByLabelText('名前') as HTMLInputElement
    expect(input.value).toBe('継続探索者')
    expect(getFieldCell('uid_name').querySelector('[data-parts-popover-trigger]')).toBeNull()

    fireEvent.change(input, { target: { value: '新規探索者' } })
    expect(onChange).toHaveBeenCalledWith('uid_name', '新規探索者')

    rerender(
      <MantineProvider>
        <TemplateFormRenderer template={template} values={{ uid_name: '更新済み探索者' }} onChange={onChange} />
      </MantineProvider>
    )
    expect(input.value).toBe('更新済み探索者')
  })

  it('renderField override は指定 field だけを差し替えて section と layout 構造を保つ', () => {
    const renderField = jest.fn((field: SheetField, defaultNode: ReactNode) => field.uid === 'uid_score'
      ? <div data-preview-field={field.uid}>preview: {field.label}</div>
      : defaultNode)

    render(
      <MantineProvider>
        <TemplateFormRenderer template={template} values={{}} renderField={renderField} />
      </MantineProvider>
    )

    expect(screen.getByRole('heading', { level: 2, name: 'プロフィール' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'メモ' })).toBeTruthy()
    expect(getFieldCell('uid_score').dataset.gridSpan).toBe('2')
    expect(getFieldCell('uid_score').querySelector('[data-preview-field="uid_score"]')?.textContent)
      .toBe('preview: 算出値')
    expect(screen.queryByRole('textbox', { name: '算出値' })).toBeNull()
    expect(screen.getByRole('textbox', { name: '名前' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: '判定' })).toBeTruthy()
    expect(screen.getByText('耐久力').closest('[data-field-placeholder="track"]')).toBeTruthy()
    expect(renderField.mock.calls.map(([field]) => field.uid)).toEqual([
      'uid_name',
      'uid_score',
      'uid_check',
      'uid_hp',
      'uid_items',
      'uid_bond',
      'uid_tags',
      'uid_note'
    ])
  })

  it.each([
    ['track', '耐久力'],
    ['list', '所持品'],
    ['relation', '関係'],
    ['tag', 'タグ']
  ])('%s を grid の全幅 placeholder として描画する', (fieldType, label) => {
    renderForm({})

    const placeholder = screen.getByText(label).closest(`[data-field-placeholder="${fieldType}"]`) as HTMLElement
    const fieldCell = placeholder.closest('[data-field-uid]') as HTMLElement
    expect(placeholder).toBeTruthy()
    expect(placeholder.style.width).toBe('100%')
    expect(placeholder.textContent).toContain(fieldType)
    expect(fieldCell.dataset.gridSpan).toBe('full')
    expect(fieldCell.classList.contains(styles.gridField)).toBe(true)
  })
})
