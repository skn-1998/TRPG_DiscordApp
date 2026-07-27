import type { CharacterSheetTemplateEntity } from '../../../../domains/character-sheet-template/models/character-sheet-template.entity'
import type { CharacterSheetTemplateService } from '../../../../domains/character-sheet-template/character-sheet-template.service'
import type { CharacterRepository } from '../../../../domains/character/repositories/character.repository'
import {
  CharacterSheetOperationService,
  type HubProjectionCharacter
} from '../../../../features/character-sheet/services/character-sheet-operation.service'
import type { SheetMaterializerService } from '../../../../features/character-sheet/services/sheet-materializer.service'
import { HubProjectionService } from './hub-projection.service'

describe('HubProjectionService', () => {
  const character = (overrides: Partial<HubProjectionCharacter> = {}): HubProjectionCharacter => ({
    characterId: 'character-1',
    characterName: 'Alice',
    gameSystemId: 'DiceBot',
    discordUserId: 'owner-1',
    discordChannelId: '123456789012345678',
    status: {},
    sheet: {
      templateId: 'template-1',
      templateVersion: '1.0.0',
      revision: 1,
      values: { 'uid-hp': { parts: { base: 999 } } }
    },
    palette: [
      {
        key: 'hp',
        fieldRef: { uid: 'uid-hp' },
        label: 'HP (10)',
        group: 'Status',
        kind: 'resource',
        deltas: [-1, 1]
      }
    ],
    resolvedResourceValues: { 'uid-hp': 10 },
    ...overrides
  })

  it('formula max=10・parts合計12でもfeature境界の実効値10を表示する', () => {
    const projection = new HubProjectionService().create(
      character({
        sheet: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          revision: 1,
          values: { 'uid-limit': 10, 'uid-hp': { parts: { base: 12 } } }
        }
      })
    )

    expect(projection.hub.embed.fields).toEqual([{ name: 'HP', value: '10', inline: true }])
  })

  it('feature出力を実projectionへ渡し、旧paletteラベルを実効値へ整合させる', async () => {
    const sourceCharacter = character({
      discordThreadId: 'thread-1',
      hub: {
        status: 'active',
        threadId: 'thread-1',
        messageId: 'message-1',
        pendingRevision: 1,
        appliedRevision: 0
      },
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.0.0',
        revision: 1,
        values: { 'uid-limit': 10, 'uid-hp': { parts: { base: 12 } } }
      },
      palette: [
        {
          key: 'hp',
          fieldRef: { uid: 'uid-hp' },
          label: 'HP (12)',
          group: 'Status',
          kind: 'resource',
          deltas: [-1, 1]
        }
      ],
      resolvedResourceValues: undefined
    })
    const template: CharacterSheetTemplateEntity = {
      templateId: 'template-1',
      status: 'published',
      version: '1.0.0',
      schemaVersion: 3,
      name: 'Template',
      gameSystemId: 'DiceBot',
      tags: [],
      visibility: 'public',
      authorDiscordUserId: 'owner-1',
      sections: [
        {
          id: 'status',
          label: 'Status',
          fields: [
            {
              id: 'limit',
              uid: 'uid-limit',
              label: 'Limit',
              type: 'scalar',
              valueType: 'number'
            },
            {
              id: 'hp',
              uid: 'uid-hp',
              label: 'HP',
              type: 'track',
              min: 0,
              max: { formula: '{status.limit}' },
              style: 'gauge',
              role: { kind: 'resource', deltas: [-1, 1] }
            }
          ]
        }
      ],
      tables: [],
      settings: { rounding: 'floor' },
      draftRevision: 1
    }
    const operations = new CharacterSheetOperationService(
      { findById: jest.fn().mockResolvedValue(sourceCharacter) } as unknown as CharacterRepository,
      { resolvePublished: jest.fn().mockResolvedValue(template) } as unknown as CharacterSheetTemplateService,
      {} as SheetMaterializerService
    )

    const projectionCharacter = await operations.getHubCharacter('character-1')

    expect(projectionCharacter?.resolvedResourceValues).toEqual({ 'uid-hp': 10 })
    expect(new HubProjectionService().create(projectionCharacter!).hub.embed.fields).toEqual([
      { name: 'HP', value: '10', inline: true }
    ])
    expect(sourceCharacter.palette?.[0].label).toBe('HP (12)')
  })

  it('max依存値の縮小直後はfeature境界のクランプ値を表示する', () => {
    const projection = new HubProjectionService().create(
      character({
        sheet: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          revision: 2,
          values: { 'uid-limit': 5, 'uid-hp': { parts: { base: 8 } } }
        },
        palette: [
          {
            key: 'hp',
            fieldRef: { uid: 'uid-hp' },
            label: 'HP (5)',
            group: 'Status',
            kind: 'resource',
            deltas: [-1, 1]
          }
        ],
        resolvedResourceValues: { 'uid-hp': 5 }
      })
    )

    expect(projection.hub.embed.fields).toEqual([{ name: 'HP', value: '5', inline: true }])
  })

  it('範囲外のlegacy partsではfeature境界のクランプ済み実効値を表示する', () => {
    const projection = new HubProjectionService().create(character())

    expect(projection.hub.embed.fields).toEqual([{ name: 'HP', value: '10', inline: true }])
  })

  it('解決済みresource valuesが無いsnapshotは投影しない', () => {
    expect(() => new HubProjectionService().create(character({ resolvedResourceValues: undefined }))).toThrow(
      'hub projection requires resolved resource values'
    )
  })
})
