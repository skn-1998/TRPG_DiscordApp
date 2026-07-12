import { BadRequestException } from '@nestjs/common'
import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'
import { SheetEngineTemplateValidationService } from './sheet-engine-template-validation.service'

describe('SheetEngineTemplateValidationService', () => {
  let service: SheetEngineTemplateValidationService

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
        fields: [
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
