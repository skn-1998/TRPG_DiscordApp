import * as sheetProjection from '@trpg/sheet-projection'
import type { CharacterSheetTemplateEntity } from '../../../../domains/character-sheet-template/models/character-sheet-template.entity'
import type { CharacterSheetTemplateService } from '../../../../domains/character-sheet-template/character-sheet-template.service'
import type { CharacterRepository } from '../../../../domains/character/repositories/character.repository'
import type { DiceExecutionService } from '../../../../domains/dice-roll/services/dice-execution.service'
import {
  CharacterSheetOperationService,
  type HubProjectionCharacter
} from '../../../../features/character-sheet/services/character-sheet-operation.service'
import type { SheetMaterializerService } from '../../../../features/character-sheet/services/sheet-materializer.service'
import { HubProjectionService } from './hub-projection.service'

jest.mock('@trpg/sheet-projection', () => {
  const actual = jest.requireActual<typeof import('@trpg/sheet-projection')>('@trpg/sheet-projection')
  return {
    ...actual,
    createDiscordProjectionViewModel: jest.fn(actual.createDiscordProjectionViewModel)
  }
})

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
      visibility: 'private',
      values: { 'uid-hp': { parts: { base: 999 } } }
    },
    palette: [
      {
        key: 'hp',
        fieldRef: { uid: 'uid-hp' },
        label: 'HP (999)',
        group: 'Status',
        kind: 'resource',
        deltas: [-1, 1]
      }
    ],
    resolvedResourceValues: { 'uid-hp': 999 },
    ...overrides
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('sheet visibility を DiscordProjectionInput へ渡さない', () => {
    const createProjection = jest.mocked(sheetProjection.createDiscordProjectionViewModel)

    new HubProjectionService().create(
      character({
        sheet: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          revision: 1,
          visibility: 'public',
          values: { 'uid-hp': 10 }
        }
      })
    )

    expect(createProjection).toHaveBeenCalledTimes(1)
    expect(createProjection.mock.calls[0][0]).not.toHaveProperty('visibility')
  })

  it('formula max=10・parts合計12をfeature境界のraw値12で表示する', () => {
    const projection = new HubProjectionService().create(
      character({
        sheet: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          revision: 1,
          visibility: 'private',
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
        resolvedResourceValues: { 'uid-hp': 12 }
      })
    )

    expect(projection.hub.embed.fields).toEqual([{ name: 'HP', value: '12', inline: true }])
  })

  it('feature出力を実projectionへ渡し、旧paletteラベルをraw値へ整合させる', async () => {
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
        visibility: 'private',
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
      { resolvePinnedRevision: jest.fn().mockResolvedValue(template) } as unknown as CharacterSheetTemplateService,
      {} as SheetMaterializerService,
      // hub 投影はダイスを実行しないため、振り直し用の依存は未呼び出しのまま渡す。
      {} as DiceExecutionService
    )

    const projectionCharacter = await operations.getHubCharacter('character-1')

    expect(projectionCharacter?.resolvedResourceValues).toEqual({ 'uid-hp': 12 })
    expect(new HubProjectionService().create(projectionCharacter!).hub.embed.fields).toEqual([
      { name: 'HP', value: '12', inline: true }
    ])
    expect(sourceCharacter.palette?.[0].label).toBe('HP (12)')
  })

  it('max依存値の縮小直後もfeature境界のraw値を表示する', () => {
    const projection = new HubProjectionService().create(
      character({
        sheet: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          revision: 2,
          visibility: 'private',
          values: { 'uid-limit': 5, 'uid-hp': { parts: { base: 8 } } }
        },
        palette: [
          {
            key: 'hp',
            fieldRef: { uid: 'uid-hp' },
            label: 'HP (8)',
            group: 'Status',
            kind: 'resource',
            deltas: [-1, 1]
          }
        ],
        resolvedResourceValues: { 'uid-hp': 8 }
      })
    )

    expect(projection.hub.embed.fields).toEqual([{ name: 'HP', value: '8', inline: true }])
  })

  it('範囲外のlegacy partsではfeature境界のraw値を表示する', () => {
    const projection = new HubProjectionService().create(character())

    expect(projection.hub.embed.fields).toEqual([{ name: 'HP', value: '999', inline: true }])
  })

  it('解決済みresource valuesが無いsnapshotは投影しない', () => {
    expect(() => new HubProjectionService().create(character({ resolvedResourceValues: undefined }))).toThrow(
      'hub projection requires resolved resource values'
    )
  })
})
