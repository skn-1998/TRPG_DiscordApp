import { ConflictException, UnprocessableEntityException } from '@nestjs/common'
import type { CharacterEntity } from '../../../domains/character/models/character.entity'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import type { MaterializedCharacterSheet } from '../types/character-sheet.types'
import { CharacterInstantiationService } from './character-instantiation.service'
import { SheetMaterializerService } from './sheet-materializer.service'

describe('CharacterInstantiationService', () => {
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
            id: 'dex',
            uid: 'uid-dex',
            label: 'DEX',
            type: 'roll',
            notation: '3d6*5',
            rollOnCreate: true,
            role: { kind: 'rollable', notation: '1d100<={value}', group: 'ability' }
          },
          {
            id: 'dex_half',
            uid: 'uid-dex-half',
            label: 'DEX Half',
            type: 'computed',
            resultType: 'number',
            formula: 'floor({parameter.dex}/2)'
          }
        ]
      }
    ],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  const materialized: MaterializedCharacterSheet = {
    sheet: {
      templateId: 'template-1',
      templateVersion: '1.0.0',
      revision: 1,
      visibility: 'private',
      values: { 'uid-dex': 55 }
    },
    computedCache: { 'uid-dex-half': 27 },
    projection: {
      status: {},
      parameter: {
        dex: {
          name: 'DEX',
          values: { base: 50, buff: 5, temp: 0, other: 0 },
          index: 0,
          isVisible: true
        }
      },
      skill: {},
      item: {},
      description: {}
    },
    palette: [
      {
        key: 'dex',
        fieldRef: { uid: 'uid-dex' },
        label: 'DEX (55)',
        kind: 'roll',
        notation: '1d100<=55',
        group: 'ability'
      }
    ]
  }

  const trackCreationTemplate = (
    max: number | { formula: string },
    includeLimit = false
  ): CharacterSheetTemplateEntity => ({
    ...template,
    sections: [
      ...(includeLimit
        ? [
            {
              id: 'parameter',
              label: 'Parameter',
              fields: [
                {
                  id: 'limit',
                  uid: 'uid-limit',
                  label: 'Limit',
                  type: 'scalar' as const,
                  valueType: 'number' as const
                }
              ]
            }
          ]
        : []),
      {
        id: 'status',
        label: 'Status',
        fields: [
          {
            id: 'hp',
            uid: 'uid-hp',
            label: 'HP',
            type: 'track',
            min: 0,
            max,
            style: 'gauge',
            role: { kind: 'resource', deltas: [-1, 1] }
          }
        ]
      }
    ]
  })

  const created: CharacterEntity = {
    characterId: 'char-1',
    characterName: 'Investigator',
    gameSystemId: 'DiceBot',
    discordUserId: 'user-1',
    discordChannelId: 'channel-1',
    discordThreadId: 'thread-1',
    sheet: materialized.sheet,
    computedCache: materialized.computedCache,
    palette: materialized.palette,
    status: materialized.projection.status,
    parameter: materialized.projection.parameter,
    skill: materialized.projection.skill,
    item: materialized.projection.item,
    description: materialized.projection.description,
    hub: { status: 'none' },
    appliedInteractionIds: []
  }

  const instantiateInput = {
    templateId: 'template-1',
    templateVersion: '1.0.0',
    requesterDiscordUserId: 'user-1',
    characterName: 'Investigator',
    discordUserId: 'user-1',
    discordChannelId: 'channel-1',
    discordThreadId: 'thread-1'
  }

  function createDependencies() {
    const templateService = { resolveForCreate: jest.fn().mockResolvedValue(template) }
    const characterRepository = { createMaterializedCharacter: jest.fn().mockResolvedValue(created) }
    const characterIdService = { generateUniqueCharacterId: jest.fn().mockResolvedValue('char-1') }
    const diceExecutionService = {
      executeEvaluatedDiceRoll: jest.fn().mockResolvedValue({ total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' })
    }
    const sheetMaterializer = {
      validateInputValues: jest.fn().mockImplementation((_template, values) => values),
      materialize: jest.fn().mockReturnValue(materialized)
    }
    const service = new CharacterInstantiationService(
      templateService as any,
      characterRepository as any,
      characterIdService as any,
      diceExecutionService as any,
      sheetMaterializer as any
    )

    return {
      service,
      templateService,
      characterRepository,
      characterIdService,
      diceExecutionService,
      sheetMaterializer
    }
  }

  it('新規 sheet を private 固定で materialize し、単一 insert まで順に実行する', async () => {
    const dependencies = createDependencies()

    const result = await dependencies.service.instantiate(instantiateInput)

    expect(dependencies.templateService.resolveForCreate).toHaveBeenCalledWith('template-1', '1.0.0', 'user-1')
    expect(dependencies.sheetMaterializer.validateInputValues).toHaveBeenCalledWith(template, {})
    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledWith('3d6*5', 'DiceBot')
    expect(dependencies.sheetMaterializer.materialize).toHaveBeenCalledWith({
      template,
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.0.0',
        revision: 1,
        visibility: 'private',
        values: { 'uid-dex': 55 }
      }
    })
    expect(dependencies.characterRepository.createMaterializedCharacter).toHaveBeenCalledTimes(1)
    expect(dependencies.characterRepository.createMaterializedCharacter).toHaveBeenCalledWith({
      characterId: 'char-1',
      characterName: 'Investigator',
      gameSystemId: 'DiceBot',
      discordUserId: 'user-1',
      discordChannelId: 'channel-1',
      discordThreadId: 'thread-1',
      sheet: materialized.sheet,
      computedCache: materialized.computedCache,
      palette: materialized.palette,
      status: materialized.projection.status,
      parameter: materialized.projection.parameter,
      skill: materialized.projection.skill,
      item: materialized.projection.item,
      description: materialized.projection.description,
      hub: { status: 'none' },
      appliedInteractionIds: []
    })

    const resolveOrder = dependencies.templateService.resolveForCreate.mock.invocationCallOrder[0]
    const validateOrder = dependencies.sheetMaterializer.validateInputValues.mock.invocationCallOrder[0]
    const diceOrder = dependencies.diceExecutionService.executeEvaluatedDiceRoll.mock.invocationCallOrder[0]
    const materializeOrder = dependencies.sheetMaterializer.materialize.mock.invocationCallOrder[0]
    const insertOrder = dependencies.characterRepository.createMaterializedCharacter.mock.invocationCallOrder[0]
    expect(resolveOrder).toBeLessThan(validateOrder)
    expect(validateOrder).toBeLessThan(diceOrder)
    expect(diceOrder).toBeLessThan(materializeOrder)
    expect(materializeOrder).toBeLessThan(insertOrder)

    expect(result.rollOnCreateResults).toEqual([
      { uid: 'uid-dex', notation: '3d6*5', total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' }
    ])
    expect(result.materialized.sheet.visibility).toBe('private')
    expect(result.character).toBe(created)
    expect(result.materialized).toBe(materialized)
  })

  it.each([
    ['computed uid', { 'uid-dex-half': 27 }],
    ['unknown uid', { 'uid-unknown': 10 }]
  ])('提出された %s を roll 前に 422 で拒否し insert しない', async (_caseName, values) => {
    const dependencies = createDependencies()
    const realMaterializer = new SheetMaterializerService()
    dependencies.sheetMaterializer.validateInputValues.mockImplementation((resolvedTemplate, submittedValues) =>
      realMaterializer.validateInputValues(resolvedTemplate, submittedValues)
    )

    await expect(dependencies.service.instantiate({ ...instantiateInput, values })).rejects.toBeInstanceOf(
      UnprocessableEntityException
    )

    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expect(dependencies.sheetMaterializer.materialize).not.toHaveBeenCalled()
    expect(dependencies.characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })

  it('rollOnCreate付きtrackのdice結果が範囲外なら422にして後続処理を実行しない', async () => {
    const dependencies = createDependencies()
    const rollOnCreateTrackTemplate: CharacterSheetTemplateEntity = {
      ...trackCreationTemplate(10),
      sections: [
        {
          id: 'status',
          label: 'Status',
          fields: [
            {
              id: 'hp',
              uid: 'uid-hp',
              label: 'HP',
              type: 'track',
              min: 0,
              max: 10,
              style: 'gauge',
              notation: '1d20',
              rollOnCreate: true,
              role: { kind: 'resource', deltas: [-1, 1] }
            }
          ]
        }
      ]
    }
    dependencies.templateService.resolveForCreate.mockResolvedValue(rollOnCreateTrackTemplate)
    dependencies.diceExecutionService.executeEvaluatedDiceRoll.mockResolvedValue({
      total: 15,
      details: '(1D20) ＞ 15'
    })

    await expect(dependencies.service.instantiate(instantiateInput)).rejects.toBeInstanceOf(
      UnprocessableEntityException
    )

    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledWith('1d20', 'DiceBot')
    expect(dependencies.sheetMaterializer.materialize).not.toHaveBeenCalled()
    expect(dependencies.characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })

  it.each([
    ['数値max × 素の数値', trackCreationTemplate(10), { 'uid-hp': 999 }],
    [
      'formula max × parts合計',
      trackCreationTemplate({ formula: '{parameter.limit}' }, true),
      { 'uid-limit': 10, 'uid-hp': { parts: { base: 999, other: 0 } } }
    ]
  ])('新規作成の範囲外trackを422にしてinsertしない: %s', async (_caseName, resolvedTemplate, values) => {
    const dependencies = createDependencies()
    dependencies.templateService.resolveForCreate.mockResolvedValue(resolvedTemplate)

    await expect(dependencies.service.instantiate({ ...instantiateInput, values })).rejects.toBeInstanceOf(
      UnprocessableEntityException
    )

    expect(dependencies.sheetMaterializer.materialize).not.toHaveBeenCalled()
    expect(dependencies.characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })

  it('version/published 解決失敗時は後続処理も insert も実行しない', async () => {
    const dependencies = createDependencies()
    dependencies.templateService.resolveForCreate.mockRejectedValue(
      new ConflictException('sheet template must be published at the requested version')
    )

    await expect(dependencies.service.instantiate(instantiateInput)).rejects.toBeInstanceOf(ConflictException)

    expect(dependencies.sheetMaterializer.validateInputValues).not.toHaveBeenCalled()
    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expect(dependencies.sheetMaterializer.materialize).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })

  it('評価または正準形投影に失敗した場合は 422 とし insert しない', async () => {
    const dependencies = createDependencies()
    dependencies.sheetMaterializer.materialize.mockImplementation(() => {
      throw new TypeError('Invalid parameter: expected AttributeSection canonical form')
    })

    await expect(dependencies.service.instantiate(instantiateInput)).rejects.toBeInstanceOf(
      UnprocessableEntityException
    )

    expect(dependencies.characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })
})
