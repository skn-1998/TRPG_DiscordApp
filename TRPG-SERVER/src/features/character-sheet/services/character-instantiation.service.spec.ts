import { CharacterEntity } from '../../../domains/character/models/character.entity'
import { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { CharacterInstantiationService } from './character-instantiation.service'

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

  it('テンプレート解決、rollOnCreate、materialize、CharacterService.create を順に実行する', async () => {
    const created: CharacterEntity = {
      characterId: 'char-1',
      characterName: 'Investigator',
      gameSystemId: 'DiceBot',
      discordUserId: 'user-1',
      discordChannelId: 'channel-1',
      parameter: { dex: { name: 'DEX', values: { base: 55 } } },
      status: {}
    }
    const templateService = { findOne: jest.fn().mockResolvedValue(template) }
    const characterService = { create: jest.fn().mockResolvedValue(created) }
    const characterIdService = { generateUniqueCharacterId: jest.fn().mockResolvedValue('char-1') }
    const diceExecutionService = {
      executeEvaluatedDiceRoll: jest.fn().mockResolvedValue({ total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' })
    }
    const sheetMaterializer = {
      materialize: jest.fn().mockReturnValue({
        sheet: { templateId: 'template-1', templateVersion: '1.0.0', revision: 1, values: { 'uid-dex': 55 } },
        computedCache: { 'uid-dex-half': 25 },
        projection: {
          status: {},
          parameter: { dex: { name: 'DEX', values: { base: 55 } } },
          skill: {},
          item: {},
          description: {}
        },
        palette: []
      })
    }
    const service = new CharacterInstantiationService(
      templateService as any,
      characterService as any,
      characterIdService as any,
      diceExecutionService as any,
      sheetMaterializer as any
    )

    const result = await service.instantiate({
      templateId: 'template-1',
      requesterDiscordUserId: 'user-1',
      characterName: 'Investigator',
      discordUserId: 'user-1',
      discordChannelId: 'channel-1'
    })

    expect(templateService.findOne).toHaveBeenCalledWith('template-1', 'user-1')
    expect(diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledWith('3d6*5', 'DiceBot')
    expect(sheetMaterializer.materialize).toHaveBeenCalledWith({
      template,
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.0.0',
        revision: 1,
        values: { 'uid-dex': 55 }
      }
    })
    expect(characterService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: 'char-1',
        characterName: 'Investigator',
        gameSystemId: 'DiceBot',
        discordUserId: 'user-1',
        discordChannelId: 'channel-1',
        parameter: { dex: { name: 'DEX', values: { base: 55 } } }
      })
    )
    expect(result.rollOnCreateResults).toEqual([
      { uid: 'uid-dex', notation: '3d6*5', total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' }
    ])
    expect(result.character).toBe(created)
  })
})
