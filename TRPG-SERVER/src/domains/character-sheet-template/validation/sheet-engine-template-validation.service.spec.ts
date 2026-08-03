import { BadRequestException } from '@nestjs/common'
import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'
import { SheetEngineTemplateValidationService } from './sheet-engine-template-validation.service'

describe('SheetEngineTemplateValidationService', () => {
  let service: SheetEngineTemplateValidationService

  const templateFields = [
    { id: 'str', uid: 'uid-str', label: 'STR', type: 'scalar', valueType: 'number' },
    {
      id: 'str_half',
      uid: 'uid-str-half',
      label: 'STR Half',
      type: 'computed',
      resultType: 'number',
      formula: 'floor({main.str}/2)'
    }
  ]

  const template: CharacterSheetTemplateEntity = {
    templateId: 'template-1',
    status: 'draft',
    version: '0.1.0',
    schemaVersion: 3,
    name: 'Template',
    tags: [],
    visibility: 'public',
    authorDiscordUserId: 'user-1',
    sections: [
      {
        id: 'main',
        label: 'Main',
        fields: templateFields
      }
    ],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  beforeEach(() => {
    service = new SheetEngineTemplateValidationService()
  })

  it('sheet-engine の publish 検証で有効なテンプレートを許可する', () => {
    expect(() => service.validateForPublish(template)).not.toThrow()
  })

  it('式が壊れているテンプレートは保存検証で拒否する', () => {
    const broken: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { id: 'str', uid: 'uid-str', label: 'STR', type: 'scalar', valueType: 'number' },
            {
              id: 'bad',
              uid: 'uid-bad',
              label: 'Bad',
              type: 'computed',
              resultType: 'number',
              formula: 'floor({main.str}'
            }
          ]
        }
      ]
    }

    expect(() => service.validateForSave(broken)).toThrow(BadRequestException)
  })

  it('publish は public visibility 以外を拒否する', () => {
    expect(() => service.validateForPublish({ ...template, visibility: 'private' })).toThrow(BadRequestException)
  })

  it('standalone roll の定数のみ表記は publish で拒否するが save は許可する', () => {
    const constantRoll: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [{ id: 'fixed', uid: 'uid-fixed', label: 'Fixed', type: 'roll', notation: '10' }]
        }
      ]
    }

    expect(() => service.validateForSave(constantRoll)).not.toThrow()
    expect(() => service.validateForPublish(constantRoll)).toThrow(
      /main\.fixed\.notation: standalone roll expression must contain at least one literal dice term/
    )
  })

  it.each([
    'd6',
    '2d6+1d4',
    '1d6+1d6+2',
    '2d6+1',
    '3d6*5',
    '(2d6+6)*5',
    '1d8{main.str}',
    '{main.str}d10',
    '({main.str})d10'
  ])('publish は standalone roll %s を許可する', (notation) => {
    const rollTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [...templateFields, { id: 'roll', uid: 'uid-roll', label: 'Roll', type: 'roll', notation }]
        }
      ]
    }

    expect(() => service.validateForPublish(rollTemplate)).not.toThrow()
  })

  it('publish は dangling な standalone roll 参照を拒否する', () => {
    const danglingRoll: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            ...templateFields,
            { id: 'roll', uid: 'uid-roll', label: 'Roll', type: 'roll', notation: '1d8{derived.db}' }
          ]
        }
      ]
    }

    expect(() => service.validateForPublish(danglingRoll)).toThrow(/Unknown field reference: derived\.db/)
  })

  it('publish は検証済み notation fragment への standalone roll 参照を許可する', () => {
    const referencedRoll: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            ...templateFields,
            { id: 'roll', uid: 'uid-roll', label: 'Roll', type: 'roll', notation: '1d8{derived.db}' }
          ]
        },
        {
          id: 'derived',
          label: 'Derived',
          fields: [
            {
              id: 'db',
              uid: 'uid-db',
              label: 'DB',
              type: 'computed',
              resultType: 'dice',
              formula: "'+1d4'"
            }
          ]
        }
      ]
    }

    expect(() => service.validateForPublish(referencedRoll)).not.toThrow()
  })

  it('T-23: publish は description へ集約される top-level field id 重複を拒否するが save は許可する', () => {
    const duplicatedProjectionKey: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'profile',
          label: 'Profile',
          fields: [{ id: 'memo', uid: 'uid-profile-memo', label: 'Profile memo', type: 'scalar', valueType: 'text' }]
        },
        {
          id: 'notes',
          label: 'Notes',
          fields: [{ id: 'memo', uid: 'uid-notes-memo', label: 'Notes memo', type: 'scalar', valueType: 'text' }]
        }
      ]
    }

    expect(() => service.validateForSave(duplicatedProjectionKey)).not.toThrow()
    expect(() => service.validateForPublish(duplicatedProjectionKey)).toThrow(
      /duplicate projected field id in description: memo/
    )
  })
})
