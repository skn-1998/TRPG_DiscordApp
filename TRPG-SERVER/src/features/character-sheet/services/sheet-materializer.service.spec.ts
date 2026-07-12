import { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { LEGACY_COC_TEMPLATE } from '../../../domains/character-sheet-template/seeds/legacy-coc.template'
import { SheetMaterializerService } from './sheet-materializer.service'

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

  beforeEach(() => {
    service = new SheetMaterializerService()
  })

  it('computedCache は engine evaluate で再計算し、提出された computed 値を無視する', () => {
    const result = service.materialize({
      template,
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.0.0',
        revision: 1,
        values: { 'uid-str': 60, 'uid-str-half': 999 }
      }
    })

    expect(result.computedCache).toEqual({ 'uid-str-half': 30 })
    expect(result.sheet.values).toEqual({ 'uid-str': 60 })
    expect(result.projection.parameter.str.values).toEqual({ base: 60 })
    expect(result.projection.parameter.str_half.values).toEqual({ base: 30 })
  })

  it('rollable role から補間済み palette を生成し、既存 key を維持する', () => {
    const result = service.materialize({
      template,
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.0.0',
        revision: 1,
        values: { 'uid-str': 65 }
      },
      existingPalette: [
        {
          key: 'legacystr',
          fieldRef: { uid: 'uid-str' },
          label: 'old',
          kind: 'roll',
          notation: 'old',
          group: 'old'
        }
      ]
    })

    expect(result.palette).toEqual([
      {
        key: 'legacystr',
        fieldRef: { uid: 'uid-str' },
        label: 'STR (65)',
        kind: 'roll',
        notation: '1d100<=65',
        group: 'ability'
      }
    ])
  })

  it('legacy-coc の description セクションを互換投影へ残す', () => {
    const result = service.materialize({
      template: LEGACY_COC_TEMPLATE as unknown as CharacterSheetTemplateEntity,
      sheet: {
        templateId: 'legacy-coc',
        templateVersion: '1.0.0',
        revision: 1,
        values: {
          lgc_str: 50,
          lgc_con: 55,
          lgc_pow: 60,
          lgc_siz: 60,
          lgc_occupation: 'Antiquarian',
          lgc_personality: 'Careful'
        }
      }
    })

    expect(result.projection.description.occupation.description).toBe('Antiquarian')
    expect(result.projection.description.personality.description).toBe('Careful')
  })

  it('palette が hard cap 512 を超えた場合はエラーにする', () => {
    const oversizedTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'parameter',
          label: 'Parameter',
          fields: Array.from({ length: 513 }, (_, index) => ({
            id: `roll_${index}`,
            uid: `uid-roll-${index}`,
            label: `Roll ${index}`,
            type: 'scalar',
            valueType: 'number',
            role: { kind: 'rollable', notation: '1d100<={value}', group: 'ability' }
          }))
        }
      ]
    }

    expect(() =>
      service.materialize({
        template: oversizedTemplate,
        sheet: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          revision: 1,
          values: Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`uid-roll-${index}`, 50]))
        }
      })
    ).toThrow('palette entries exceed hard cap: 513/512')
  })
})
