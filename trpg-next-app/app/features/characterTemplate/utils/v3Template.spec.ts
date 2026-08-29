// この import は engine のビルド済み dist を読む。現存の `pnpm test` は `ensure:workspace-dist` を前置するが、素の `pnpm exec jest` 直叩きは stale dist で偽の緑になり得る。
import { validatePublishTemplate } from '@trpg/sheet-engine'
import type { Template } from '../types/v2'
import type { CharacterSheetTemplateEntity, LookupTable, SheetSection, V3EditorFieldType } from '../types/v3'
import {
  collectFieldIds,
  collectFieldUids,
  createEditorSignature,
  createField,
  createSection,
  createStableUid,
  isV2LocalTemplate,
  makeUniqueId,
  migrateV2TemplateToCreateRequest,
  normalizeTemplateReferences,
  parseTemplateImportJson,
  parseTags,
  safeParseTables,
  slugifyId,
  stringifyTables,
  stringifyTags,
  toSheetTemplate,
  validateLocalTemplate
} from './v3Template'

const findSection = (sections: SheetSection[], id: string) => {
  const section = sections.find((candidate) => candidate.id === id)
  if (!section) throw new Error(`section not found: ${id}`)
  return section
}

describe('v3Template id and uid helpers', () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto
    })
    jest.restoreAllMocks()
  })

  // NOTE: 正本 pin は app/lib/stable-uid.spec.ts。ここは re-export の疎通維持。
  it('createStableUid は crypto.randomUUID の衝突を避けて同一 prefix で再発行する', () => {
    const randomUUID = jest
      .fn()
      .mockReturnValueOnce('aaaaaaaa-1111-2222-3333-444444444444')
      .mockReturnValueOnce('bbbbbbbb-1111-2222-3333-444444444444')

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID }
    })

    const uid = createStableUid(new Set(['field_aaaaaaaa1111']), 'field')

    expect(uid).toBe('field_bbbbbbbb1111')
    expect(randomUUID).toHaveBeenCalledTimes(2)
  })

  // NOTE: 正本 pin は app/lib/stable-uid.spec.ts。ここは re-export の疎通維持。
  it('createStableUid は crypto がない環境では Math.random 由来の uid を発行する', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined
    })
    jest.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(createStableUid(new Set(), 'fallback')).toBe('fallback_i')
  })

  it('slugifyId と makeUniqueId は予約語・数字始まり・重複を安全な field id に変換する', () => {
    expect(slugifyId('  STR Value!!  ', 'field')).toBe('str_value')
    expect(slugifyId('123 invalid', 'fallback')).toBe('fallback')
    expect(slugifyId('max', 'field')).toBe('max_field')
    expect(makeUniqueId('pow', new Set(['pow', 'pow_2']))).toBe('pow_3')
    expect(makeUniqueId('very_long_field_name_more_than_32_chars', new Set())).toBe('very_long_field_name_mor')
  })

  it('collectFieldIds と collectFieldUids は section 内の id とネスト field uid を収集する', () => {
    const section: SheetSection = {
      id: 'skills',
      label: 'Skills',
      fields: [
        { id: 'name', uid: 'uid_name', label: 'Name', type: 'scalar', valueType: 'text' },
        {
          id: 'items',
          uid: 'uid_items',
          label: 'Items',
          type: 'list',
          itemFields: [{ id: 'rank', uid: 'uid_rank', label: 'Rank', type: 'scalar', valueType: 'number' }]
        },
        {
          id: 'target',
          uid: 'uid_target',
          label: 'Target',
          type: 'relation',
          attrs: [{ id: 'memo', uid: 'uid_memo', label: 'Memo', type: 'scalar', valueType: 'text' }]
        }
      ]
    }

    expect([...collectFieldIds(section)]).toEqual(['name', 'items', 'target'])
    expect([...collectFieldUids([section])]).toEqual(['uid_name', 'uid_items', 'uid_rank', 'uid_target', 'uid_memo'])
  })
})

describe('v3Template editor field builders', () => {
  it.each([
    ['number', { type: 'scalar', valueType: 'number' }],
    [
      'select',
      {
        type: 'scalar',
        valueType: 'select',
        options: [
          { label: '選択肢1', value: 'option_1' },
          { label: '選択肢2', value: 'option_2' }
        ]
      }
    ],
    ['checkbox', { type: 'scalar', valueType: 'boolean' }],
    ['computed', { type: 'computed', resultType: 'number', formula: '0' }],
    ['roll', { type: 'roll', notation: '1d100' }],
    ['track', { type: 'track', max: 10, style: 'gauge' }],
    ['text', { type: 'scalar', valueType: 'text' }]
  ] satisfies Array<[V3EditorFieldType, Record<string, unknown>]>)(
    'createField は %s の初期 field を作る',
    (type, expected) => {
      const section: SheetSection = {
        id: 'basic',
        label: '基本',
        fields: [{ id: 'pow', uid: 'basic_existing', label: 'POW', type: 'scalar', valueType: 'number' }]
      }

      const field = createField(type, section, 'POW')

      expect(field).toMatchObject({
        id: 'pow_2',
        label: 'POW',
        visibleTo: 'public',
        ...expected
      })
      expect(field.uid).toMatch(/^basic_/)
      expect(field.uid).not.toBe('basic_existing')
    }
  )

  it('createField の track 既定値は engine の publish 検証を通過する', () => {
    const section: SheetSection = { id: 'status', label: 'ステータス', fields: [] }
    const field = createField('track', section, 'HP')

    expect(field).toEqual({
      id: 'hp',
      uid: expect.stringMatching(/^status_/),
      label: 'HP',
      visibleTo: 'public',
      type: 'track',
      max: 10,
      style: 'gauge'
    })
    expect(
      validatePublishTemplate({
        templateId: 'track-default',
        name: 'Track default',
        version: '1.0.0',
        schemaVersion: 3,
        tags: [],
        visibility: 'private',
        authorDiscordUserId: 'user_1',
        sections: [{ ...section, fields: [field] }],
        tables: [],
        settings: { rounding: 'floor' }
      }).issues
    ).toEqual([])
  })

  it('createSection は予約語と空 label を正規化する', () => {
    const duplicate = createSection([{ id: 'basic', label: '基本', fields: [] }], 'basic')
    const blank = createSection([], '   ')
    const reserved = createSection([], 'row')

    expect(duplicate).toEqual({ id: 'basic_2', label: 'basic', fields: [] })
    expect(blank).toEqual({ id: 'field', label: '新規セクション', fields: [] })
    expect(reserved).toEqual({ id: 'row_field', label: 'row', fields: [] })
  })
})

describe('normalizeTemplateReferences and toSheetTemplate', () => {
  it('computed/list/track の flat 参照だけを一意な section path に正規化する', () => {
    const normalized = normalizeTemplateReferences({
      sections: [
        {
          id: 'parameter',
          label: 'パラメータ',
          fields: [
            { id: 'pow', uid: 'uid_pow', label: 'POW', type: 'scalar', valueType: 'number' },
            { id: 'dup', uid: 'uid_dup_parameter', label: 'Dup P', type: 'scalar', valueType: 'number' }
          ]
        },
        {
          id: 'status',
          label: 'ステータス',
          fields: [
            { id: 'dup', uid: 'uid_dup_status', label: 'Dup S', type: 'scalar', valueType: 'number' },
            {
              id: 'san',
              uid: 'uid_san',
              label: 'SAN',
              type: 'computed',
              resultType: 'number',
              formula: '{pow} * 5 + {dup} + {unknown}'
            },
            {
              id: 'weapons',
              uid: 'uid_weapons',
              label: 'Weapons',
              type: 'list',
              itemFields: [
                {
                  id: 'damage',
                  uid: 'uid_damage',
                  label: 'Damage',
                  type: 'computed',
                  resultType: 'number',
                  formula: '{pow} + 1'
                }
              ]
            },
            {
              id: 'mp',
              uid: 'uid_mp',
              label: 'MP',
              type: 'track',
              min: 0,
              max: { formula: '{pow}' },
              resetTo: { formula: '{pow} - 1' },
              style: 'gauge'
            },
            {
              id: 'luck',
              uid: 'uid_luck',
              label: 'Luck',
              type: 'track',
              max: 99,
              resetTo: 'max',
              style: 'checkboxes'
            }
          ]
        }
      ]
    })

    const status = findSection(normalized.sections, 'status')

    expect(status.fields[1]).toMatchObject({
      type: 'computed',
      formula: '{parameter.pow} * 5 + {dup} + {unknown}'
    })
    expect(status.fields[2]).toMatchObject({
      type: 'list',
      itemFields: [{ type: 'computed', formula: '{parameter.pow} + 1' }]
    })
    expect(status.fields[3]).toMatchObject({
      type: 'track',
      max: { formula: '{parameter.pow}' },
      resetTo: { formula: '{parameter.pow} - 1' }
    })
    expect(status.fields[4]).toMatchObject({
      type: 'track',
      max: 99,
      resetTo: 'max'
    })
  })

  it('toSheetTemplate は entity metadata を draft payload に落とし込み、式参照を正規化する', () => {
    const entity: CharacterSheetTemplateEntity = {
      templateId: 'tpl_1',
      name: 'CoC',
      version: '1.2.3',
      schemaVersion: 3,
      gameSystemId: 'coc7',
      tags: ['coc'],
      visibility: 'public',
      authorDiscordUserId: 'user_1',
      forkedFrom: { templateId: 'base', version: '1.0.0' },
      license: 'MIT',
      status: 'draft',
      draftRevision: 7,
      sections: [
        {
          id: 'parameter',
          label: 'パラメータ',
          fields: [{ id: 'pow', uid: 'uid_pow', label: 'POW', type: 'scalar', valueType: 'number' }]
        },
        {
          id: 'status',
          label: 'ステータス',
          fields: [
            { id: 'san', uid: 'uid_san', label: 'SAN', type: 'computed', resultType: 'number', formula: '{pow} * 5' }
          ]
        }
      ],
      tables: [{ id: 'table_1', rows: [['01', 'success']] }],
      settings: { rounding: 'ceil' },
      createdAt: '2026-07-08T00:00:00.000Z'
    }

    expect(toSheetTemplate(entity)).toEqual({
      templateId: 'tpl_1',
      name: 'CoC',
      version: '1.2.3',
      schemaVersion: 3,
      gameSystemId: 'coc7',
      tags: ['coc'],
      visibility: 'public',
      authorDiscordUserId: 'user_1',
      forkedFrom: { templateId: 'base', version: '1.0.0' },
      license: 'MIT',
      sections: [
        {
          id: 'parameter',
          label: 'パラメータ',
          fields: [{ id: 'pow', uid: 'uid_pow', label: 'POW', type: 'scalar', valueType: 'number' }]
        },
        {
          id: 'status',
          label: 'ステータス',
          fields: [
            {
              id: 'san',
              uid: 'uid_san',
              label: 'SAN',
              type: 'computed',
              resultType: 'number',
              formula: '{parameter.pow} * 5'
            }
          ]
        }
      ],
      tables: [{ id: 'table_1', rows: [['01', 'success']] }],
      settings: { rounding: 'ceil' }
    })
  })
})

describe('v3Template validation and JSON helpers', () => {
  const validTemplate = (overrides: Partial<CharacterSheetTemplateEntity> = {}): CharacterSheetTemplateEntity => ({
    templateId: 'tpl_1',
    name: 'Valid',
    version: '1.0.0',
    schemaVersion: 3,
    tags: [],
    visibility: 'private',
    authorDiscordUserId: 'user_1',
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
    settings: { rounding: 'floor' },
    ...overrides
  })

  it('validateLocalTemplate は名前・section id・field id・重複・uid 必須を検証する', () => {
    const errors = validateLocalTemplate(
      validTemplate({
        name: '   ',
        sections: [
          {
            id: '1bad',
            label: 'Bad',
            fields: [
              { id: 'max', uid: '', label: 'Reserved', type: 'scalar', valueType: 'number' },
              { id: 'valid', uid: 'uid_valid', label: 'Valid', type: 'scalar', valueType: 'text' },
              { id: 'valid', uid: 'uid_duplicate', label: 'Duplicate', type: 'scalar', valueType: 'text' }
            ]
          }
        ]
      })
    )

    expect(errors).toEqual([
      'テンプレート名が必須です',
      'section id must match [a-z][a-z0-9_]{0,31}: 1bad',
      'field id must match [a-z][a-z0-9_]{0,31}: max',
      'field max must have uid',
      '同一セクション内の field id が重複しています: 1bad.valid'
    ])
  })

  it('validateLocalTemplate は妥当な template では error を返さない', () => {
    expect(validateLocalTemplate(validTemplate())).toEqual([])
  })

  it('parseTags/stringifyTags は空白と空要素を除外して相互変換する', () => {
    expect(parseTags(' coc, , dx3 ,  sword-world  ')).toEqual(['coc', 'dx3', 'sword-world'])
    expect(stringifyTags(['coc', 'dx3'])).toBe('coc, dx3')
  })

  it('parseTemplateImportJson は余分キーを含む object をそのまま payload として返す', () => {
    expect(
      parseTemplateImportJson('{"name":"JSON テンプレート","sections":[],"templateId":"server-managed"}')
    ).toEqual({
      ok: true,
      payload: { name: 'JSON テンプレート', sections: [], templateId: 'server-managed' }
    })
  })

  it('parseTemplateImportJson は JSON parse 失敗を定型文で返す', () => {
    expect(parseTemplateImportJson('{"name":')).toEqual({
      ok: false,
      error: 'JSON として読み取れません'
    })
  })

  it.each([
    ['配列', '[]'],
    ['null', 'null']
  ])('parseTemplateImportJson はトップレベルが%sなら拒否する', (_label, text) => {
    expect(parseTemplateImportJson(text)).toEqual({
      ok: false,
      error: 'テンプレート JSON はオブジェクトである必要があります'
    })
  })

  it.each([
    ['name 欠落', '{}'],
    ['空白のみの name', '{"name":"   "}']
  ])('parseTemplateImportJson は%sを拒否する', (_label, text) => {
    expect(parseTemplateImportJson(text)).toEqual({
      ok: false,
      error: 'name（テンプレート名）は必須です'
    })
  })

  it('safeParseTables/stringifyTables は空入力・配列 JSON・不正 JSON 型を区別する', () => {
    const tables: LookupTable[] = [{ id: 'crit', rows: [[1, 'critical']] }]

    expect(safeParseTables('   ')).toEqual([])
    expect(safeParseTables(JSON.stringify(tables))).toEqual(tables)
    expect(stringifyTables(tables)).toBe(
      '[\n  {\n    "id": "crit",\n    "rows": [\n      [\n        1,\n        "critical"\n      ]\n    ]\n  }\n]'
    )
    expect(() => safeParseTables('{"id":"crit"}')).toThrow('tables は JSON array で入力してください')
  })

  it('createEditorSignature は template が同一でも tables の内容差を検出する', () => {
    const template = validTemplate()

    expect(createEditorSignature(template, '[]')).not.toBe(
      createEditorSignature(template, '[{"id":"crit","rows":[[1,"critical"]]}]')
    )
  })

  it('createEditorSignature は tablesText の空白整形差を無視する', () => {
    const template = validTemplate()
    const tables: LookupTable[] = [{ id: 'crit', rows: [[1, 'critical']] }]
    const compactTablesText = JSON.stringify(tables)
    const formattedTablesText = stringifyTables(tables)

    expect(createEditorSignature(template, compactTablesText)).toBe(
      createEditorSignature(template, formattedTablesText)
    )
    expect(createEditorSignature(template, compactTablesText)).toBe(
      createEditorSignature(validTemplate({ tables }), formattedTablesText)
    )
  })

  it('createEditorSignature は invalid JSON でも throw せず決定的かつ valid JSON と異なる署名を返す', () => {
    const template = validTemplate()
    const invalidTablesText = '[{"id":"crit"}'

    expect(() => createEditorSignature(template, invalidTablesText)).not.toThrow()
    expect(createEditorSignature(template, invalidTablesText)).toBe(
      createEditorSignature(template, invalidTablesText)
    )
    expect(createEditorSignature(template, invalidTablesText)).not.toBe(createEditorSignature(template, '[]'))
  })

  it('createEditorSignature は template の内容差を検出する', () => {
    expect(createEditorSignature(validTemplate(), '[]')).not.toBe(
      createEditorSignature(validTemplate({ name: 'Changed' }), '[]')
    )
  })

  const acceptedV2Fixtures: Array<
    [label: string, value: unknown, expectedSectionId: string, expectedField: Record<string, unknown>]
  > = [
    [
      'type と tab が欠落した field',
      { schemaVersion: 2, name: 'Missing type', fields: [{ id: 'missing_type' }] },
      'basic',
      { id: 'missing_type', type: 'scalar', valueType: 'text' }
    ],
    [
      '未知 type の field',
      { schemaVersion: 2, name: 'Unknown type', fields: [{ id: 'unknown_type', tab: 'status', type: 'mystery' }] },
      'status',
      { id: 'unknown_type', type: 'scalar', valueType: 'text' }
    ],
    [
      'text field',
      { schemaVersion: 2, name: 'Text', fields: [{ id: 'text_field', tab: 'basic', type: 'text' }] },
      'basic',
      { id: 'text_field', type: 'scalar', valueType: 'text' }
    ],
    [
      'textarea field',
      { schemaVersion: 2, name: 'Textarea', fields: [{ id: 'textarea_field', tab: 'basic', type: 'textarea' }] },
      'basic',
      { id: 'textarea_field', type: 'scalar', valueType: 'text' }
    ],
    [
      'number field',
      { schemaVersion: 2, name: 'Number', fields: [{ id: 'number_field', tab: 'parameter', type: 'number' }] },
      'parameter',
      { id: 'number_field', type: 'scalar', valueType: 'number' }
    ],
    [
      'select field',
      { schemaVersion: 2, name: 'Select', fields: [{ id: 'select_field', tab: 'basic', type: 'select' }] },
      'basic',
      { id: 'select_field', type: 'scalar', valueType: 'select', options: undefined }
    ],
    [
      'checkbox field',
      { schemaVersion: 2, name: 'Checkbox', fields: [{ id: 'checkbox_field', tab: 'status', type: 'checkbox' }] },
      'status',
      { id: 'checkbox_field', type: 'scalar', valueType: 'boolean' }
    ],
    [
      'computed field',
      {
        schemaVersion: 2,
        name: 'Computed',
        fields: [{ id: 'computed_field', tab: 'status', type: 'computed', formula: '1 + 2' }]
      },
      'status',
      { id: 'computed_field', type: 'computed', resultType: 'number', formula: '1 + 2' }
    ],
    [
      'roll field',
      {
        schemaVersion: 2,
        name: 'Roll',
        fields: [{ id: 'roll_field', tab: 'skill', type: 'roll', diceFormula: '[1d100]' }]
      },
      'skill',
      { id: 'roll_field', type: 'roll', notation: '1d100' }
    ]
  ]

  it.each(acceptedV2Fixtures)(
    '%sを受理し、migration の直接消費値を出力する',
    (_label, value, expectedSectionId, expectedField) => {
      const migrateAccepted = () => [value].filter(isV2LocalTemplate).map(migrateV2TemplateToCreateRequest)

      expect(isV2LocalTemplate(value)).toBe(true)
      expect(migrateAccepted).not.toThrow()

      const migrated = migrateAccepted()
      expect(migrated).toHaveLength(1)
      expect(migrated[0].sections.filter((section) => section.fields.length > 0).map((section) => section.id)).toEqual([
        expectedSectionId
      ])
      expect(findSection(migrated[0].sections, expectedSectionId).fields).toEqual([
        expect.objectContaining(expectedField)
      ])
    }
  )

  it.each([
    ['prototype 継承キー', 'constructor'],
    ['未知 key', 'unknown_tab']
  ])('tab が%sのとき各 migration フォールバック値を出力する', (_label, tab) => {
    const value: unknown = {
      schemaVersion: 2,
      name: 'Fallbacks',
      version: '',
      tags: null,
      fields: [{ id: 'fallback_field', tab, type: 'mystery' }]
    }
    const migrateAccepted = () => [value].filter(isV2LocalTemplate).map(migrateV2TemplateToCreateRequest)

    expect(isV2LocalTemplate(value)).toBe(true)
    expect(migrateAccepted).not.toThrow()

    const migrated = migrateAccepted()
    expect(migrated).toHaveLength(1)
    expect(migrated[0]).toMatchObject({ version: '0.1.0', tags: [] })
    expect(migrated[0].sections.filter((section) => section.fields.length > 0).map((section) => section.id)).toEqual([
      'basic'
    ])
    expect(findSection(migrated[0].sections, 'basic').fields).toEqual([
      expect.objectContaining({ id: 'fallback_field', type: 'scalar', valueType: 'text' })
    ])
  })

  it.each([
    ['schemaVersion 2 と空 fields 以外を持たない値', { schemaVersion: 2, fields: [{}] }],
    ['id のない field を含む値', { schemaVersion: 2, name: 'Missing field id', fields: [{ id: 'memo' }, {}] }],
    ['name のない値', { schemaVersion: 2, fields: [{ id: 'memo' }] }],
    ['schemaVersion が 2 ではない値', { schemaVersion: 3, name: 'V3', fields: [] }],
    ['fields が array ではない値', { schemaVersion: 2, name: 'Invalid fields', fields: {} }]
  ])('%sを拒否する', (_label, value) => {
    expect(isV2LocalTemplate(value)).toBe(false)
  })

  it.each([
    ['roll', 'diceFormula 欠落', { schemaVersion: 2, name: 'x', fields: [{ id: 'a', type: 'roll' }] }],
    [
      'roll',
      'diceFormula の型違い',
      { schemaVersion: 2, name: 'x', fields: [{ id: 'a', type: 'roll', diceFormula: 3 }] }
    ],
    ['computed', 'formula 欠落', { schemaVersion: 2, name: 'x', fields: [{ id: 'a', type: 'computed' }] }],
    [
      'computed',
      'formula の型違い',
      { schemaVersion: 2, name: 'x', fields: [{ id: 'a', type: 'computed', formula: 1 }] }
    ]
  ])('%s field の%sを拒否する', (_type, _reason, value) => {
    expect(isV2LocalTemplate(value)).toBe(false)
  })

  it('id のない field は migration に渡さず slugifyId(undefined) への到達を防ぐ', () => {
    const candidates: unknown[] = [{ schemaVersion: 2, name: 'Broken V2', fields: [{}] }]
    const migrate = jest.fn(migrateV2TemplateToCreateRequest)

    expect(candidates.filter(isV2LocalTemplate).map(migrate)).toEqual([])
    expect(migrate).not.toHaveBeenCalled()
  })

  it('null を拒否する', () => {
    expect(isV2LocalTemplate(null)).toBe(false)
  })
})

describe('migrateV2TemplateToCreateRequest', () => {
  it('v2 computed formula の flat field reference を canonical path へ正規化する', () => {
    const template: Template = {
      id: 'v2-coc',
      name: 'V2 CoC',
      version: '1.0.0',
      schemaVersion: 2,
      fields: [
        {
          id: 'pow',
          label: 'POW',
          tab: 'parameter',
          type: 'number'
        },
        {
          id: 'san',
          label: 'SAN',
          tab: 'status',
          type: 'computed',
          formula: '{pow} * 5'
        }
      ]
    }

    const migrated = migrateV2TemplateToCreateRequest(template)
    const statusSection = migrated.sections.find((section) => section.id === 'status')
    const sanField = statusSection?.fields.find((field) => field.id === 'san')

    expect(sanField).toMatchObject({
      type: 'computed',
      formula: '{parameter.pow} * 5'
    })
  })

  it('v2 の各 field 型を v3 section と field 型へ変換し、roll の diceFormula は角括弧を外す', () => {
    const template: Template = {
      id: 'v2-full',
      name: 'Full',
      version: '',
      schemaVersion: 2,
      tags: ['coc', 'private'],
      fields: [
        { id: 'name', label: 'Name', description: 'character name', tab: 'basic', type: 'text' },
        { id: 'memo', label: 'Memo', tab: 'basic', type: 'textarea', rows: 4 },
        { id: 'pow', label: 'POW', tab: 'parameter', type: 'number', min: 1, max: 99 },
        { id: 'job', label: 'Job', tab: 'basic', type: 'select', options: [{ label: '探偵', value: 'detective' }] },
        { id: 'alive', label: 'Alive', tab: 'status', type: 'checkbox', defaultValue: true },
        { id: 'san', label: 'SAN', tab: 'status', type: 'computed', formula: '{pow} * 5' },
        { id: 'san_check', label: 'SAN Check', tab: 'skill', type: 'roll', diceFormula: '[1d100]' },
        { id: 'free_roll', label: 'Free Roll', tab: 'skill', type: 'roll', diceFormula: '2d6+6' }
      ]
    }

    const migrated = migrateV2TemplateToCreateRequest(template)

    expect(migrated).toMatchObject({
      name: 'Full (v3移行)',
      version: '0.1.0',
      schemaVersion: 3,
      tags: ['coc', 'private'],
      visibility: 'private',
      tables: [],
      settings: { rounding: 'floor' }
    })
    expect(migrated.sections.map((section) => section.id)).toEqual(['basic', 'status', 'parameter', 'skill'])
    expect(findSection(migrated.sections, 'basic').fields).toMatchObject([
      {
        id: 'name',
        uid: expect.stringMatching(/^basic_/),
        label: 'Name',
        description: 'character name',
        type: 'scalar',
        valueType: 'text'
      },
      { id: 'memo', uid: expect.stringMatching(/^basic_/), label: 'Memo', type: 'scalar', valueType: 'text' },
      {
        id: 'job',
        uid: expect.stringMatching(/^basic_/),
        label: 'Job',
        type: 'scalar',
        valueType: 'select',
        options: [{ label: '探偵', value: 'detective' }]
      }
    ])
    expect(findSection(migrated.sections, 'status').fields).toMatchObject([
      { id: 'alive', type: 'scalar', valueType: 'boolean' },
      { id: 'san', type: 'computed', resultType: 'number', formula: '{parameter.pow} * 5' }
    ])
    expect(findSection(migrated.sections, 'parameter').fields).toMatchObject([
      { id: 'pow', type: 'scalar', valueType: 'number' }
    ])
    expect(findSection(migrated.sections, 'skill').fields).toMatchObject([
      { id: 'san_check', type: 'roll', notation: '1d100' },
      { id: 'free_roll', type: 'roll', notation: '2d6+6' }
    ])
  })

  it('未知 tab は basic に寄せ、未知 type は text scalar として扱い、重複 id は suffix を付ける', () => {
    const template = {
      id: 'v2-unknown',
      name: 'Unknown',
      version: '1.0.0',
      schemaVersion: 2,
      fields: [
        { id: 'memo', label: 'Memo 1', tab: 'unknown', type: 'mystery' },
        { id: 'memo', label: 'Memo 2', tab: 'basic', type: 'text' }
      ],
      layout: []
    } as unknown as Template

    const basic = findSection(migrateV2TemplateToCreateRequest(template).sections, 'basic')

    expect(basic.fields).toMatchObject([
      { id: 'memo', label: 'Memo 1', type: 'scalar', valueType: 'text' },
      { id: 'memo_2', label: 'Memo 2', type: 'scalar', valueType: 'text' }
    ])
  })

  it('field が空でも 4 つの空 section を持つ create payload を構築する', () => {
    const migrated = migrateV2TemplateToCreateRequest({
      id: 'empty',
      name: 'Empty',
      version: '2.0.0',
      schemaVersion: 2,
      fields: []
    })

    expect(migrated.sections).toEqual([
      { id: 'basic', label: '基本情報', fields: [] },
      { id: 'status', label: 'ステータス', fields: [] },
      { id: 'parameter', label: 'パラメータ', fields: [] },
      { id: 'skill', label: 'スキル', fields: [] }
    ])
  })
})
