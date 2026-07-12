import { BadRequestException } from '@nestjs/common'
import { BasicTemplateValidationService } from './basic-template-validation.service'
import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'

describe('BasicTemplateValidationService', () => {
  let service: BasicTemplateValidationService

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
        fields: [{ id: 'hp', uid: 'uid-hp', label: 'HP', type: 'scalar', visibleTo: 'public' }]
      }
    ],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  beforeEach(() => {
    service = new BasicTemplateValidationService()
  })

  it('保存検証は id 規約と uid 一意性を満たすテンプレートを許可する', () => {
    expect(() => service.validateForSave(template)).not.toThrow()
  })

  it('uid が重複している場合は保存を拒否する', () => {
    const duplicated: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          fields: [
            { id: 'hp', uid: 'uid-same', label: 'HP', type: 'scalar' },
            { id: 'mp', uid: 'uid-same', label: 'MP', type: 'scalar' }
          ]
        }
      ]
    }

    expect(() => service.validateForSave(duplicated)).toThrow(BadRequestException)
  })

  it('publish は visibility が public 以外なら拒否する', () => {
    expect(() => service.validateForPublish({ ...template, visibility: 'private' })).toThrow(BadRequestException)
  })

  it('publish は visibleTo が public 以外の field を拒否する', () => {
    const hidden: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          fields: [{ id: 'secret', uid: 'uid-secret', label: 'Secret', type: 'scalar', visibleTo: 'owner' }]
        }
      ]
    }

    expect(() => service.validateForPublish(hidden)).toThrow(BadRequestException)
  })

  it('未知 role kind は拒否する', () => {
    const unknownRole: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          fields: [{ id: 'hp', uid: 'uid-hp', label: 'HP', type: 'scalar', role: { kind: 'secret' } }]
        }
      ]
    }

    expect(() => service.validateForSave(unknownRole)).toThrow(BadRequestException)
  })

  it('publish は未知 field type を拒否する', () => {
    const unknownType: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          fields: [{ id: 'memo', uid: 'uid-memo', label: 'Memo', type: 'text' }]
        }
      ]
    }

    expect(() => service.validateForPublish(unknownType)).toThrow(BadRequestException)
  })

  it('publish は list rowRole の未知 kind を拒否する', () => {
    const unknownRowRole: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          fields: [
            {
              id: 'items',
              uid: 'uid-items',
              label: 'Items',
              type: 'list',
              rowRole: { kind: 'secret' },
              itemFields: [{ id: 'name', uid: 'uid-name', label: 'Name', type: 'scalar' }]
            }
          ]
        }
      ]
    }

    expect(() => service.validateForPublish(unknownRowRole)).toThrow(BadRequestException)
  })

  it('publish は secret フラグ付き field を拒否する', () => {
    const secret: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          fields: [{ id: 'secret', uid: 'uid-secret', label: 'Secret', type: 'scalar', secret: true }]
        }
      ]
    }

    expect(() => service.validateForPublish(secret)).toThrow(BadRequestException)
  })

  it('publish は list の itemFields 内 roll/list を拒否する', () => {
    const nestedRoll: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          fields: [
            {
              id: 'items',
              uid: 'uid-items',
              label: 'Items',
              type: 'list',
              rowRole: { kind: 'profile' },
              itemFields: [{ id: 'attack', uid: 'uid-attack', label: 'Attack', type: 'roll' }]
            }
          ]
        }
      ]
    }

    expect(() => service.validateForPublish(nestedRoll)).toThrow(BadRequestException)
  })
})
