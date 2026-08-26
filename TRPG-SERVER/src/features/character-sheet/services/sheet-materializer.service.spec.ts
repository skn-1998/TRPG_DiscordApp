import { UnprocessableEntityException } from '@nestjs/common'
import type { SheetField } from '@trpg/sheet-engine'
import { isAttributeSection } from '../../../core/types/attribute.types'
import { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { LEGACY_COC_TEMPLATE } from '../../../domains/character-sheet-template/seeds/legacy-coc.template'
import { SheetMaterializerService } from './sheet-materializer.service'

// expectUnprocessable は 422 応答の assertion 群を内包するヘルパー。ルール自体は生かしたまま、
// 呼び出しを assertion として認識させるため対象名に加える。
/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect", "expectUnprocessable"] }] */

describe('SheetMaterializerService', () => {
  let service: SheetMaterializerService

  const template: CharacterSheetTemplateEntity = {
    templateId: 'template-1',
    status: 'published',
    version: '1.0.0',
    schemaVersion: 3,
    name: 'Template',
    gameSystemId: 'DiceBot',
    tags: [],
    visibility: 'public',
    authorDiscordUserId: 'user-1',
    sections: [
      {
        id: 'parameter',
        label: 'Parameter',
        fields: [
          {
            id: 'str',
            uid: 'uid-str',
            label: 'STR',
            type: 'scalar',
            valueType: 'number',
            role: { kind: 'rollable', notation: '1d100<={value}', group: 'ability' }
          },
          {
            id: 'str_half',
            uid: 'uid-str-half',
            label: 'STR Half',
            type: 'computed',
            resultType: 'number',
            formula: 'floor({parameter.str}/2)'
          }
        ]
      }
    ],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  const templateWithFields = (fields: SheetField[]): CharacterSheetTemplateEntity => ({
    ...template,
    sections: [{ id: 'parameter', label: 'Parameter', fields }]
  })

  const rowRoleListField: SheetField = {
    id: 'custom_skills',
    uid: 'uid-custom-skills',
    label: 'Custom Skills',
    type: 'list',
    itemFields: [
      { id: 'name', uid: 'uid-skill-name', label: 'Name', type: 'scalar', valueType: 'text' },
      { id: 'value', uid: 'uid-skill-value', label: 'Value', type: 'scalar', valueType: 'number' }
    ],
    rowRole: {
      kind: 'rollable',
      notation: '1d100<={row.value}',
      group: 'skills',
      labelSubFieldId: 'name'
    }
  }

  const rowRoleValues = [
    { rowId: 'row-spot-hidden', 'uid-skill-name': 'Spot Hidden', 'uid-skill-value': 60 },
    { rowId: 'row-listen', 'uid-skill-name': 'Listen', 'uid-skill-value': 45 },
    { rowId: 'row-library-use', 'uid-skill-name': 'Library Use', 'uid-skill-value': 70 }
  ]

  const materialize = (
    targetTemplate: CharacterSheetTemplateEntity,
    values: Record<string, unknown>,
    existingPalette?: Parameters<SheetMaterializerService['materialize']>[0]['existingPalette']
  ) =>
    service.materialize({
      template: targetTemplate,
      sheet: {
        templateId: targetTemplate.templateId,
        templateVersion: targetTemplate.version,
        revision: 1,
        visibility: 'private',
        values
      },
      existingPalette
    })

  const expectUnprocessable = (action: () => unknown, expectedFieldUid?: string) => {
    try {
      action()
      throw new Error('expected UnprocessableEntityException')
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException)
      const response = (error as UnprocessableEntityException).getResponse() as {
        statusCode: number
        issues: Array<{ fieldUid?: string; path: string[]; message: string }>
      }
      expect(response.statusCode).toBe(422)
      expect(response.issues.length).toBeGreaterThan(0)
      if (expectedFieldUid) {
        expect(response.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ fieldUid: expectedFieldUid })])
        )
      }
    }
  }

  beforeEach(() => {
    service = new SheetMaterializerService()
  })

  it('入力 sheet の public visibility を materialize 出力へ保持する', () => {
    const result = service.materialize({
      template,
      sheet: {
        templateId: template.templateId,
        templateVersion: template.version,
        revision: 1,
        visibility: 'public',
        values: { 'uid-str': 60 }
      }
    })

    expect(result.sheet.visibility).toBe('public')
  })

  it('T-1: validateInputValues は computed uid と未知 uid を field-level 422 で拒否する', () => {
    expectUnprocessable(() => service.validateInputValues(template, { 'uid-str-half': 999 }), 'uid-str-half')
    expectUnprocessable(() => service.validateInputValues(template, { unknown: 1 }), 'unknown')
  })

  it('C-17: validateInputValues は schema 検査済みの parts 値を返す', () => {
    const partsTemplate = templateWithFields([
      {
        id: 'score',
        uid: 'uid-score',
        label: 'Score',
        type: 'scalar',
        valueType: 'number',
        parts: true
      }
    ])
    const values = { 'uid-score': { parts: { base: 5, buff: 2 } } }

    expect(service.validateInputValues(partsTemplate, values)).toEqual(values)
  })

  it('C-1: materialize の full state でも computed uid を黙って捨てず拒否する', () => {
    expectUnprocessable(() => materialize(template, { 'uid-str': 60, 'uid-str-half': 999 }), 'uid-str-half')
  })

  it('T-13: computedCache と roll palette は同じ評価結果を使う', () => {
    const computedPaletteTemplate = templateWithFields([
      {
        id: 'str',
        uid: 'uid-str',
        label: 'STR',
        type: 'scalar',
        valueType: 'number'
      },
      {
        id: 'str_half',
        uid: 'uid-str-half',
        label: 'STR Half',
        type: 'computed',
        resultType: 'number',
        formula: 'floor({parameter.str}/2)',
        role: { kind: 'rollable', notation: '1d100<={value}', group: 'ability' }
      }
    ])

    const result = materialize(computedPaletteTemplate, { 'uid-str': 61 })

    expect(result.computedCache).toEqual({ 'uid-str-half': 30 })
    expect(result.palette[0]).toEqual(expect.objectContaining({ label: 'STR Half (30)', notation: '1d100<=30' }))
  })

  it('C-01/C-16: rowRole 宣言 list の各行を label 宣言と行値から roll palette にする', () => {
    const result = materialize(templateWithFields([rowRoleListField]), {
      'uid-custom-skills': rowRoleValues
    })

    expect(result.palette).toEqual([
      {
        key: 'customskills',
        fieldRef: { uid: 'uid-custom-skills', rowId: 'row-spot-hidden' },
        label: 'Spot Hidden',
        kind: 'roll',
        notation: '1d100<=60',
        group: 'skills'
      },
      {
        key: 'customskills2',
        fieldRef: { uid: 'uid-custom-skills', rowId: 'row-listen' },
        label: 'Listen',
        kind: 'roll',
        notation: '1d100<=45',
        group: 'skills'
      },
      {
        key: 'customskills3',
        fieldRef: { uid: 'uid-custom-skills', rowId: 'row-library-use' },
        label: 'Library Use',
        kind: 'roll',
        notation: '1d100<=70',
        group: 'skills'
      }
    ])
  })

  it('rowRole を持たない list は従来どおり palette に出さない', () => {
    const result = materialize(templateWithFields([{ ...rowRoleListField, rowRole: undefined }]), {
      'uid-custom-skills': rowRoleValues
    })

    expect(result.palette).toEqual([])
    expect(result.projection.parameter).toEqual({})
  })

  it('T-01/T-02: 行の並べ替えと途中行の削除後も残存 rowId の key を維持する', () => {
    const targetTemplate = templateWithFields([rowRoleListField])
    const initial = materialize(targetTemplate, { 'uid-custom-skills': rowRoleValues })
    const reorderedRows = [rowRoleValues[2], rowRoleValues[0], rowRoleValues[1]]
    const reordered = materialize(targetTemplate, { 'uid-custom-skills': reorderedRows }, initial.palette)
    const afterDeletion = materialize(
      targetTemplate,
      { 'uid-custom-skills': [reorderedRows[0], reorderedRows[2]] },
      reordered.palette
    )
    const keysByRowId = (palette: typeof initial.palette) =>
      Object.fromEntries(palette.map((entry) => [entry.fieldRef.rowId, entry.key]))

    expect(keysByRowId(reordered.palette)).toEqual(keysByRowId(initial.palette))
    expect(keysByRowId(afterDeletion.palette)).toEqual({
      'row-library-use': 'customskills3',
      'row-listen': 'customskills2'
    })
  })

  it('同名 label の行 2 本でも suffix 採番で異なる key を割り当てる', () => {
    const result = materialize(templateWithFields([rowRoleListField]), {
      'uid-custom-skills': [
        { rowId: 'row-first', 'uid-skill-name': 'Spot Hidden', 'uid-skill-value': 50 },
        { rowId: 'row-second', 'uid-skill-name': 'Spot Hidden', 'uid-skill-value': 55 }
      ]
    })

    expect(result.palette.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: 'customskills', label: 'Spot Hidden' },
      { key: 'customskills2', label: 'Spot Hidden' }
    ])
  })

  it('T-12: 宣言済み dodge と同名行を別名前空間の AttributeValue として両方投影する', () => {
    const skillTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'skill',
          label: 'Skill',
          fields: [
            { id: 'dodge', uid: 'uid-dodge', label: 'Dodge', type: 'scalar', valueType: 'number' },
            rowRoleListField
          ]
        }
      ]
    }

    const result = materialize(skillTemplate, {
      'uid-dodge': 40,
      'uid-custom-skills': [{ rowId: 'row-dodge', 'uid-skill-name': 'dodge', 'uid-skill-value': 60 }]
    })

    expect(result.projection.skill).toEqual({
      dodge: { name: 'Dodge', index: 0, values: { base: 40 }, isVisible: true },
      'custom_skills:row-dodge': { name: 'dodge', index: 1, values: { base: 60 }, isVisible: true }
    })
  })

  it('T-13/T-14: 同名 label の 3 行を挿入順の別キーで投影する', () => {
    const result = materialize(templateWithFields([rowRoleListField]), {
      'uid-custom-skills': [
        { rowId: 'row-first', 'uid-skill-name': 'Dodge', 'uid-skill-value': 50 },
        { rowId: 'row-second', 'uid-skill-name': 'Dodge', 'uid-skill-value': 55 },
        { rowId: 'row-third', 'uid-skill-name': 'Dodge', 'uid-skill-value': 60 }
      ]
    })

    expect(result.projection.parameter).toEqual({
      'custom_skills:row-first': { name: 'Dodge', index: 0, values: { base: 50 }, isVisible: true },
      'custom_skills:row-second': { name: 'Dodge', index: 0, values: { base: 55 }, isVisible: true },
      'custom_skills:row-third': { name: 'Dodge', index: 0, values: { base: 60 }, isVisible: true }
    })
  })

  it('row参照のない固定notation行はpaletteに出すが投影しない', () => {
    const fixedNotationField: SheetField = {
      ...rowRoleListField,
      rowRole: {
        kind: 'rollable',
        notation: '1d100<=50',
        group: 'skills',
        labelSubFieldId: 'name'
      }
    }
    const result = materialize(templateWithFields([fixedNotationField]), {
      'uid-custom-skills': [{ rowId: 'row-fixed', 'uid-skill-name': 'Fixed', 'uid-skill-value': 60 }]
    })

    expect(result.palette).toEqual([
      expect.objectContaining({
        fieldRef: { uid: 'uid-custom-skills', rowId: 'row-fixed' },
        notation: '1d100<=50'
      })
    ])
    expect(result.projection.parameter).toEqual({})
  })

  it('複数のrow参照を持つnotationでは最初の参照subfieldを投影値にする', () => {
    const multipleReferenceField: SheetField = {
      ...rowRoleListField,
      itemFields: [
        ...rowRoleListField.itemFields,
        { id: 'bonus', uid: 'uid-skill-bonus', label: 'Bonus', type: 'scalar', valueType: 'number' }
      ],
      rowRole: {
        kind: 'rollable',
        notation: '1d100<={row.bonus}+{row.value}',
        group: 'skills',
        labelSubFieldId: 'name'
      }
    }
    const result = materialize(templateWithFields([multipleReferenceField]), {
      'uid-custom-skills': [
        {
          rowId: 'row-multiple',
          'uid-skill-name': 'Multiple',
          'uid-skill-value': 50,
          'uid-skill-bonus': 5
        }
      ]
    })

    expect(result.palette[0]).toEqual(expect.objectContaining({ notation: '1d100<=5+50' }))
    expect(result.projection.parameter['custom_skills:row-multiple']).toEqual({
      name: 'Multiple',
      index: 0,
      values: { base: 5 },
      isVisible: true
    })
  })

  it('行0本のrowRole listは投影キーを作らない', () => {
    const result = materialize(templateWithFields([rowRoleListField]), {
      'uid-custom-skills': []
    })

    expect(Object.keys(result.projection.parameter)).toHaveLength(0)
  })

  it('行削除後の再 materialize で削除行の投影キーだけを除去する', () => {
    const targetTemplate = templateWithFields([rowRoleListField])
    const initial = materialize(targetTemplate, { 'uid-custom-skills': rowRoleValues })
    const afterDeletion = materialize(targetTemplate, {
      'uid-custom-skills': [rowRoleValues[0], rowRoleValues[2]]
    })

    expect(initial.projection.parameter).toHaveProperty('custom_skills:row-listen')
    expect(afterDeletion.projection.parameter).toEqual({
      'custom_skills:row-spot-hidden': {
        name: 'Spot Hidden',
        index: 0,
        values: { base: 60 },
        isVisible: true
      },
      'custom_skills:row-library-use': {
        name: 'Library Use',
        index: 0,
        values: { base: 70 },
        isVisible: true
      }
    })
  })

  it('rowRole 行の宣言済み parts を AttributeValue.values へ全保持する', () => {
    const partsListField: SheetField = {
      ...rowRoleListField,
      itemFields: [
        rowRoleListField.itemFields[0],
        {
          id: 'value',
          uid: 'uid-skill-value',
          label: 'Value',
          type: 'scalar',
          valueType: 'number',
          partsKeys: [
            { id: 'occupation', label: 'Occupation' },
            { id: 'interest', label: 'Interest' }
          ]
        }
      ]
    }
    const result = materialize(templateWithFields([partsListField]), {
      'uid-custom-skills': [
        {
          rowId: 'row-parts',
          'uid-skill-name': 'Dodge',
          'uid-skill-value': { parts: { occupation: 20, interest: 15 } }
        }
      ]
    })

    expect(result.projection.parameter['custom_skills:row-parts']).toEqual({
      name: 'Dodge',
      index: 0,
      values: { occupation: 20, interest: 15 },
      isVisible: true
    })
  })

  it('T-11: 宣言 entry を引いた実効行数上限の超過を原因 list つき 422 にする', () => {
    const directPaletteFields: SheetField[] = [
      {
        id: 'direct_roll',
        uid: 'uid-direct-roll',
        label: 'Direct Roll',
        type: 'scalar',
        valueType: 'number',
        role: { kind: 'rollable', notation: '1d100<={value}' }
      },
      {
        id: 'direct_resource',
        uid: 'uid-direct-resource',
        label: 'Direct Resource',
        type: 'track',
        min: 0,
        max: 100,
        style: 'gauge',
        role: { kind: 'resource', deltas: [-1, 1] }
      }
    ]
    const rows = Array.from({ length: 511 }, (_, index) => ({
      rowId: `row-${index}`,
      'uid-skill-name': `Skill ${index}`,
      'uid-skill-value': 50
    }))
    let failure: unknown

    try {
      materialize(templateWithFields([...directPaletteFields, rowRoleListField]), {
        'uid-direct-roll': 50,
        'uid-direct-resource': 50,
        'uid-custom-skills': rows
      })
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const response = (failure as UnprocessableEntityException).getResponse() as {
      statusCode: number
      message: string
      issues: Array<{ fieldUid?: string; message: string }>
    }
    expect(response.statusCode).toBe(422)
    expect(response.message).toBe('Character sheet palette exceeds effective row limit')
    expect(response.issues).toEqual([
      {
        fieldUid: 'uid-custom-skills',
        path: ['uid-custom-skills'],
        message:
          'list uid-custom-skills has 511 rows; 2 non-row palette declarations leave effective row limit ' +
          '510, but rowRole rows total 511'
      }
    ])
  })

  it('T-11: 宣言 rollable 2 本と実効上限ちょうど 510 行で palette 512 entry を生成する', () => {
    const directPaletteFields: SheetField[] = [
      {
        id: 'direct_roll_first',
        uid: 'uid-direct-roll-first',
        label: 'Direct Roll First',
        type: 'scalar',
        valueType: 'number',
        role: { kind: 'rollable', notation: '1d100<={value}' }
      },
      {
        id: 'direct_roll_second',
        uid: 'uid-direct-roll-second',
        label: 'Direct Roll Second',
        type: 'scalar',
        valueType: 'number',
        role: { kind: 'rollable', notation: '1d100<={value}' }
      }
    ]
    const rows = Array.from({ length: 510 }, (_, index) => ({
      rowId: `row-${index}`,
      'uid-skill-name': `Skill ${index}`,
      'uid-skill-value': 50
    }))

    const result = materialize(templateWithFields([...directPaletteFields, rowRoleListField]), {
      'uid-direct-roll-first': 50,
      'uid-direct-roll-second': 50,
      'uid-custom-skills': rows
    })

    expect(result.palette).toHaveLength(512)
  })

  it('C-08: 非正準数値で生成された notation を list uid・rowId・key つき 422 で拒否する', () => {
    let failure: unknown

    try {
      materialize(templateWithFields([rowRoleListField]), {
        'uid-custom-skills': [{ rowId: 'row-large', 'uid-skill-name': 'Large', 'uid-skill-value': 1e21 }]
      })
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const response = (failure as UnprocessableEntityException).getResponse() as {
      statusCode: number
      message: string
      issues: Array<{ fieldUid?: string; path: string[]; message: string }>
    }
    expect(response.statusCode).toBe(422)
    expect(response.message).toBe('Character sheet row palette notation is invalid')
    expect(response.issues).toEqual([
      {
        fieldUid: 'uid-custom-skills',
        path: ['uid-custom-skills', 'row-large', 'customskills'],
        message:
          'list uid-custom-skills rowId row-large palette key customskills generated invalid notation: 1d100<=1e+21'
      }
    ])
  })

  it.each<[string, string, number, string]>([
    ['小数', 'row-decimal', 0.5, '1d100<=0.5'],
    ['負数', 'row-negative', -5, '1d100<=-5']
  ])('C-08: 行値の%sを list uid・rowId・key つき 422 で拒否する', (_caseName, rowId, value, notation) => {
    let failure: unknown

    try {
      materialize(templateWithFields([rowRoleListField]), {
        'uid-custom-skills': [{ rowId, 'uid-skill-name': 'Invalid', 'uid-skill-value': value }]
      })
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const response = (failure as UnprocessableEntityException).getResponse() as {
      statusCode: number
      message: string
      issues: Array<{ fieldUid?: string; path: string[]; message: string }>
    }
    expect(response.statusCode).toBe(422)
    expect(response.message).toBe('Character sheet row palette notation is invalid')
    expect(response.issues).toEqual([
      {
        fieldUid: 'uid-custom-skills',
        path: ['uid-custom-skills', rowId, 'customskills'],
        message:
          `list uid-custom-skills rowId ${rowId} palette key customskills generated invalid notation: ` + notation
      }
    ])
  })

  it('rowRole の list subfield aggregate 参照を catch 経路の行単位 422 にする', () => {
    const aggregateNotationField: SheetField = {
      ...rowRoleListField,
      rowRole: {
        kind: 'rollable',
        notation: '1d100<={parameter.custom_skills.value}',
        group: 'skills',
        labelSubFieldId: 'name'
      }
    }
    let failure: unknown

    try {
      materialize(templateWithFields([aggregateNotationField]), {
        'uid-custom-skills': [{ rowId: 'row-aggregate', 'uid-skill-name': 'Aggregate', 'uid-skill-value': 50 }]
      })
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const response = (failure as UnprocessableEntityException).getResponse() as {
      statusCode: number
      message: string
      issues: Array<{ fieldUid?: string; path: string[]; message: string }>
    }
    expect(response.statusCode).toBe(422)
    expect(response.message).toBe('Character sheet row palette notation is invalid')
    expect(response.issues).toEqual([
      {
        fieldUid: 'uid-custom-skills',
        path: ['uid-custom-skills', 'row-aggregate', 'customskills'],
        message:
          'list uid-custom-skills rowId row-aggregate palette key customskills: ' +
          'List aggregate cannot be interpolated directly: parameter.custom_skills.value'
      }
    ])
  })

  it('section 直下の rollable/resource entry の形と既存 key を変えない', () => {
    const directTemplate = templateWithFields([
      {
        id: 'check',
        uid: 'uid-check',
        label: 'Check',
        type: 'scalar',
        valueType: 'number',
        role: { kind: 'rollable', notation: '1d100<={value}', group: 'checks' }
      },
      {
        id: 'hp',
        uid: 'uid-hp',
        label: 'HP',
        type: 'track',
        min: 0,
        max: 20,
        style: 'gauge',
        role: { kind: 'resource', deltas: [-1, 1] }
      }
    ])
    const result = materialize(directTemplate, { 'uid-check': 65, 'uid-hp': 12 }, [
      {
        key: 'stable-check',
        fieldRef: { uid: 'uid-check' },
        label: 'old',
        kind: 'roll',
        notation: '1d1',
        group: 'old'
      },
      {
        key: 'stable-hp',
        fieldRef: { uid: 'uid-hp' },
        label: 'old',
        kind: 'resource',
        deltas: [-1, 1],
        group: 'old'
      }
    ])

    expect(result.palette).toEqual([
      {
        key: 'stable-check',
        fieldRef: { uid: 'uid-check' },
        label: 'Check (65)',
        kind: 'roll',
        notation: '1d100<=65',
        group: 'checks'
      },
      {
        key: 'stable-hp',
        fieldRef: { uid: 'uid-hp' },
        label: 'HP (12)',
        kind: 'resource',
        deltas: [-1, 1],
        group: 'Parameter'
      }
    ])
  })

  it('T-5/T-22: parts を全保持し、resource palette を生成して kind 変更後も key を維持する', () => {
    const resourceTemplate = templateWithFields([
      {
        id: 'hp',
        uid: 'uid-hp',
        label: 'HP',
        type: 'scalar',
        valueType: 'number',
        parts: true,
        role: { kind: 'resource', deltas: [-5, -1, 1, 5] }
      }
    ])

    const result = materialize(
      resourceTemplate,
      { 'uid-hp': { parts: { base: 10, buff: 3, temp: -2, other: 1, custom: 4 } } },
      [
        {
          key: 'stable-hp',
          fieldRef: { uid: 'uid-hp' },
          label: 'old',
          kind: 'roll',
          notation: '1d1',
          group: 'old'
        }
      ]
    )

    expect(result.sheet.values).toEqual({
      'uid-hp': { parts: { base: 10, buff: 3, temp: -2, other: 1, custom: 4 } }
    })
    expect(result.projection.parameter.hp).toEqual({
      name: 'HP',
      index: 0,
      values: { base: 10, buff: 3, temp: -2, other: 1, custom: 4 },
      isVisible: true
    })
    expect(result.projection.parameter.hp).not.toHaveProperty('display')
    expect(result.palette).toEqual([
      {
        key: 'stable-hp',
        fieldRef: { uid: 'uid-hp' },
        label: 'HP (16)',
        kind: 'resource',
        deltas: [-5, -1, 1, 5],
        group: 'Parameter'
      }
    ])
  })

  it('T-22: track と server 生成 roll を正準形へ投影する', () => {
    const stateTemplate = templateWithFields([
      { id: 'hp', uid: 'uid-hp', label: 'HP', type: 'track', min: 0, max: 20, style: 'gauge' },
      { id: 'luck', uid: 'uid-luck', label: 'Luck', type: 'roll', notation: '1d100' },
      { id: 'damage', uid: 'uid-damage', label: 'Damage', type: 'roll', notation: '1d6' }
    ])

    const result = materialize(stateTemplate, {
      'uid-hp': { parts: { base: 10, other: -2 } },
      'uid-luck': 42,
      'uid-damage': '1d6+1'
    })

    expect(result.projection.parameter.hp.values).toEqual({ base: 10, other: -2 })
    expect(result.projection.parameter.luck.values).toEqual({ base: 42 })
    expect(result.projection.parameter.damage.dice).toBe('1d6+1')
    expect(result.sheet.values).toEqual({
      'uid-hp': { parts: { base: 10, other: -2 } },
      'uid-luck': 42,
      'uid-damage': '1d6+1'
    })
  })

  it('宣言 field の 5 セクション投影と未生成 roll の skip 規則を変えない', () => {
    const projectionTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'status',
          label: 'Status',
          fields: [{ id: 'hp', uid: 'uid-hp', label: 'HP', type: 'scalar', valueType: 'number' }]
        },
        {
          id: 'parameter',
          label: 'Parameter',
          fields: [
            { id: 'str', uid: 'uid-str', label: 'STR', type: 'scalar', valueType: 'number' },
            { id: 'luck', uid: 'uid-luck', label: 'Luck', type: 'roll', notation: '1d100' },
            { id: 'omitted', uid: 'uid-omitted', label: 'Omitted', type: 'roll', notation: '1d100' }
          ]
        },
        {
          id: 'skill',
          label: 'Skill',
          fields: [{ id: 'dodge', uid: 'uid-dodge', label: 'Dodge', type: 'scalar', valueType: 'number' }]
        },
        {
          id: 'item',
          label: 'Item',
          fields: [{ id: 'weapon', uid: 'uid-weapon', label: 'Weapon', type: 'scalar', valueType: 'text' }]
        },
        {
          id: 'memo',
          label: 'Memo',
          fields: [{ id: 'history', uid: 'uid-history', label: 'History', type: 'scalar', valueType: 'text' }]
        }
      ]
    }

    const result = materialize(projectionTemplate, {
      'uid-hp': 12,
      'uid-str': 60,
      'uid-luck': 42,
      'uid-dodge': 35,
      'uid-weapon': 'Sword',
      'uid-history': 'Veteran'
    })

    expect(result.projection).toEqual({
      status: { hp: { name: 'HP', index: 0, values: { base: 12 }, isVisible: true } },
      parameter: {
        str: { name: 'STR', index: 1000, values: { base: 60 }, isVisible: true },
        luck: { name: 'Luck', index: 1001, values: { base: 42 }, isVisible: true }
      },
      skill: { dodge: { name: 'Dodge', index: 2000, values: { base: 35 }, isVisible: true } },
      item: { weapon: { name: 'Weapon', index: 3000, description: 'Sword', isVisible: true } },
      description: { history: { name: 'History', index: 4000, description: 'Veteran', isVisible: true } }
    })
  })

  it('T-11/T-22: 評価エラー、NaN、未知 uid を永続化可能な成果物にしない', () => {
    const invalidFormulaTemplate = templateWithFields([
      {
        id: 'broken',
        uid: 'uid-broken',
        label: 'Broken',
        type: 'computed',
        resultType: 'number',
        formula: '{parameter.missing}'
      }
    ])

    expectUnprocessable(() => materialize(invalidFormulaTemplate, {}))
    expectUnprocessable(() => materialize(template, { 'uid-str': Number.NaN }), 'uid-str')
    expectUnprocessable(() => materialize(template, { unknown: 1 }), 'unknown')
  })

  it('C-25: 生成された5投影がすべて AttributeSection 正準形を満たす', () => {
    const result = materialize(template, { 'uid-str': 60 })

    expect(Object.values(result.projection).every(isAttributeSection)).toBe(true)
  })

  it('legacy-coc の golden 対象外 description セクションも互換投影へ残す', () => {
    const result = materialize(LEGACY_COC_TEMPLATE as unknown as CharacterSheetTemplateEntity, {
      lgc_str: 50,
      lgc_con: 55,
      lgc_pow: 60,
      lgc_siz: 60,
      lgc_occupation: 'Antiquarian',
      lgc_personality: 'Careful'
    })

    expect(result.projection.description.occupation.description).toBe('Antiquarian')
    expect(result.projection.description.personality.description).toBe('Careful')
  })

  it('N-6: 行 0 本では負の実効上限を list の事前 422 にせず hard cap backstop へ渡す', () => {
    const directPaletteFields: SheetField[] = Array.from({ length: 513 }, (_, index) => ({
      id: `roll_${index}`,
      uid: `uid-roll-${index}`,
      label: `Roll ${index}`,
      type: 'scalar' as const,
      valueType: 'number' as const,
      role: { kind: 'rollable' as const, notation: '1d100<={value}', group: 'ability' }
    }))
    const values = {
      ...Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`uid-roll-${index}`, 50])),
      'uid-custom-skills': []
    }

    expect(() => materialize(templateWithFields([...directPaletteFields, rowRoleListField]), values)).toThrow(
      'palette entries exceed hard cap: 513/512'
    )
  })

  it('palette が hard cap 512 を超えた場合はエラーにする', () => {
    const oversizedTemplate = templateWithFields(
      Array.from({ length: 513 }, (_, index) => ({
        id: `roll_${index}`,
        uid: `uid-roll-${index}`,
        label: `Roll ${index}`,
        type: 'scalar' as const,
        valueType: 'number' as const,
        role: { kind: 'rollable' as const, notation: '1d100<={value}', group: 'ability' }
      }))
    )

    expect(() =>
      materialize(
        oversizedTemplate,
        Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`uid-roll-${index}`, 50]))
      )
    ).toThrow('palette entries exceed hard cap: 513/512')
  })
})
