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
