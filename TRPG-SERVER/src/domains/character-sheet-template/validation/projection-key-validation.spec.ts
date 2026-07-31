import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'
import { collectProjectionKeyErrors } from './projection-key-validation'

describe('collectProjectionKeyErrors', () => {
  const template: CharacterSheetTemplateEntity = {
    templateId: 'template-1',
    status: 'draft',
    version: '0.1.0',
    schemaVersion: 3,
    name: 'Template',
    tags: [],
    visibility: 'public',
    authorDiscordUserId: 'user-1',
    sections: [],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  it('T-23: 同一投影先の field id 重複を報告する', () => {
    const errors = collectProjectionKeyErrors({
      ...template,
      sections: [
        {
          id: 'status',
          fields: [{ id: 'hp', uid: 'uid-hp-1', type: 'scalar' }]
        },
        {
          id: 'status',
          fields: [{ id: 'hp', uid: 'uid-hp-2', type: 'computed' }]
        }
      ]
    })

    expect(errors).toContain('duplicate projected field id in status: hp')
  })

  it.each([
    [
      'track 同士',
      [
        { id: 'shared', uid: 'uid-track-1', type: 'track' },
        { id: 'shared', uid: 'uid-track-2', type: 'track' }
      ]
    ],
    [
      'roll 同士（publish 時点では rawValues の有無を知り得ないため一律拒絶）',
      [
        { id: 'shared', uid: 'uid-roll-1', type: 'roll' },
        { id: 'shared', uid: 'uid-roll-2', type: 'roll' }
      ]
    ],
    [
      'scalar と track',
      [
        { id: 'shared', uid: 'uid-scalar', type: 'scalar' },
        { id: 'shared', uid: 'uid-track', type: 'track' }
      ]
    ]
  ])('T-23: %s の field id 衝突を拒絶する', (_caseName, fields) => {
    const errors = collectProjectionKeyErrors({
      ...template,
      sections: [{ id: 'status', fields }]
    })

    expect(errors).toContain('duplicate projected field id in status: shared')
  })

  it('T-23: 衝突しない scalar / computed / track / roll 混在テンプレートを許可する', () => {
    const errors = collectProjectionKeyErrors({
      ...template,
      sections: [
        {
          id: 'status',
          fields: [
            { id: 'scalar_value', uid: 'uid-scalar', type: 'scalar' },
            { id: 'computed_value', uid: 'uid-computed', type: 'computed' },
            { id: 'track_value', uid: 'uid-track', type: 'track' },
            { id: 'roll_value', uid: 'uid-roll', type: 'roll' }
          ]
        }
      ]
    })

    expect(errors).toEqual([])
  })

  it('list 内 itemFields と top-level 非投影 field は検査対象外にする', () => {
    const errors = collectProjectionKeyErrors({
      ...template,
      sections: [
        {
          id: 'status',
          fields: [
            {
              id: 'rows',
              uid: 'uid-rows',
              type: 'list',
              itemFields: [
                { id: 'hp', uid: 'uid-row-hp-1', type: 'scalar' },
                { id: 'hp', uid: 'uid-row-hp-2', type: 'scalar' }
              ]
            }
          ]
        }
      ]
    })

    expect(errors).toEqual([])
  })
})
