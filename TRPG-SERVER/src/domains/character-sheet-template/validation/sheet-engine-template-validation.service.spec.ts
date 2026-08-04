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

  it('式が壊れているテンプレートは engine 診断を配列で保存検証から返す', () => {
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

    let caught: unknown
    try {
      service.validateForSave(broken)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(BadRequestException)
    expect((caught as BadRequestException).getResponse()).toStrictEqual({
      message: ['main.bad.formula: Expected ")" after function arguments'],
      error: 'Bad Request',
      statusCode: 400
    })
  })

  it('未閉鎖 notation token は save / publish の両方で 400 にする', () => {
    const broken: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [{ id: 'broken', uid: 'uid-broken', label: 'Broken', type: 'roll', notation: '1d6{' }]
        }
      ]
    }

    for (const validate of [() => service.validateForSave(broken), () => service.validateForPublish(broken)]) {
      let caught: unknown
      try {
        validate()
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(BadRequestException)
      expect((caught as BadRequestException).getStatus()).toBe(400)
      expect((caught as BadRequestException).getResponse()).toStrictEqual({
        message: ['main.broken.notation: unclosed notation token'],
        error: 'Bad Request',
        statusCode: 400
      })
    }
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

    let caught: unknown
    try {
      service.validateForPublish(constantRoll)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(BadRequestException)
    expect((caught as BadRequestException).getResponse()).toStrictEqual({
      message: ['main.fixed.notation: standalone roll expression must contain at least one literal dice term'],
      error: 'Bad Request',
      statusCode: 400
    })
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

    let caught: unknown
    try {
      service.validateForPublish(danglingRoll)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(BadRequestException)
    expect((caught as BadRequestException).getResponse()).toStrictEqual({
      message: ['main.roll.notation: Unknown field reference: derived.db'],
      error: 'Bad Request',
      statusCode: 400
    })
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

  it('T-23: publish は description へ集約される top-level field id 重複を配列で拒否するが save は許可する', () => {
    const duplicatedProjectionKey: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'profile',
          label: 'Profile',
          fields: [
            { id: 'memo', uid: 'uid-profile-memo', label: 'Profile memo', type: 'scalar', valueType: 'text' },
            { id: 'bio', uid: 'uid-profile-bio', label: 'Profile bio', type: 'scalar', valueType: 'text' }
          ]
        },
        {
          id: 'notes',
          label: 'Notes',
          fields: [
            { id: 'memo', uid: 'uid-notes-memo', label: 'Notes memo', type: 'scalar', valueType: 'text' },
            { id: 'bio', uid: 'uid-notes-bio', label: 'Notes bio', type: 'scalar', valueType: 'text' }
          ]
        }
      ]
    }

    expect(() => service.validateForSave(duplicatedProjectionKey)).not.toThrow()

    let caught: unknown
    try {
      service.validateForPublish(duplicatedProjectionKey)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(BadRequestException)
    expect((caught as BadRequestException).getResponse()).toStrictEqual({
      message: [
        'duplicate projected field id in description: memo',
        'duplicate projected field id in description: bio'
      ],
      error: 'Bad Request',
      statusCode: 400
    })
  })
})
