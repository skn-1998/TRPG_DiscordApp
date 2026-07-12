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

  it('T-23: 同一投影先の canonical path 重複を field id 重複とは独立に報告する', () => {
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
    expect(errors).toContain('duplicate projected canonical path in status: status.hp')
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
