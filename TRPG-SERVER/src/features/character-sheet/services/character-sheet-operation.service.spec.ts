import { ConflictException, UnprocessableEntityException } from '@nestjs/common'
import type { CharacterEntity, SaveSheetMaterializedPayload } from '../../../domains/character/models/character.entity'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import { CharacterSheetOperationService } from './character-sheet-operation.service'
import { SheetMaterializerService } from './sheet-materializer.service'

describe('CharacterSheetOperationService', () => {
  const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void
    const promise = new Promise<T>((resolver) => {
      resolve = resolver
    })
    return { promise, resolve }
  }

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
            id: 'hp',
            uid: 'uid-hp',
            label: 'HP',
            type: 'track',
            min: 0,
            max: 10,
            style: 'gauge',
            role: { kind: 'resource', deltas: [-5, -1, 1, 5] }
          },
          {
            id: 'score',
            uid: 'uid-score',
            label: 'Score',
            type: 'scalar',
            valueType: 'number',
            parts: true
          },
          {
            id: 'total',
            uid: 'uid-total',
            label: 'Total',
            type: 'computed',
            resultType: 'number',
            formula: '{status.hp} + {status.score}'
          },
          {
            id: 'initiative',
            uid: 'uid-roll',
            label: 'Initiative',
            type: 'roll',
            notation: '1d6'
          }
        ]
      }
    ],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  const projection = {
    status: {},
    parameter: {},
    skill: {},
    item: {},
    description: {}
  }

  let current: CharacterEntity
  let repository: {
    findById: jest.Mock
    findByChannelId: jest.Mock
    findAll: jest.Mock
    setHubState: jest.Mock
    saveSheetMaterialized: jest.Mock
  }
  let templateService: { resolvePublished: jest.Mock }
  let materializer: { validateInputValues: jest.Mock; materialize: jest.Mock }
  let service: CharacterSheetOperationService

  const makeCharacter = (overrides: Partial<CharacterEntity> = {}): CharacterEntity => ({
    characterId: 'character-1',
    characterName: 'Alice',
    gameSystemId: 'DiceBot',
    discordUserId: 'owner-1',
    discordChannelId: 'channel-1',
    status: {},
    parameter: {},
    skill: {},
    item: {},
    description: {},
    sheet: {
      templateId: 'template-1',
      templateVersion: '1.0.0',
      revision: 1,
      values: {
        'uid-hp': { parts: { base: 8, buff: 0, temp: 0, other: 0 } },
        'uid-score': { parts: { base: 5, buff: 0, temp: 0, other: 0 } },
        'uid-roll': '4'
      }
    },
    computedCache: { 'uid-total': 13 },
    palette: [
      {
        key: 'resource-hp',
        fieldRef: { uid: 'uid-hp' },
        label: 'HP (8)',
        kind: 'resource',
        deltas: [-5, -1, 1, 5],
        group: 'Status'
      }
    ],
    hub: { status: 'active', pendingRevision: 1, appliedRevision: 1 },
    appliedInteractionIds: [],
    ...overrides
  })

  beforeEach(() => {
    current = makeCharacter()
    repository = {
      findById: jest.fn().mockImplementation(async () => current),
      findByChannelId: jest.fn().mockResolvedValue({ characterId: 'character-1' }),
      findAll: jest.fn().mockResolvedValue([]),
      setHubState: jest.fn(),
      saveSheetMaterialized: jest
        .fn()
        .mockImplementation(
          async (_characterId: string, payload: SaveSheetMaterializedPayload, expectedRevision: number) => {
            current = makeCharacter({
              ...current,
              sheet: {
                ...current.sheet!,
                revision: expectedRevision + 1,
                values: payload.values
              },
              computedCache: payload.computedCache,
              palette: payload.palette,
              status: payload.status,
              parameter: payload.parameter,
              skill: payload.skill,
              item: payload.item,
              description: payload.description,
              appliedInteractionIds: payload.appliedInteractionIds
            })
            return current
          }
        )
    }
    templateService = { resolvePublished: jest.fn().mockResolvedValue(template) }
    materializer = {
      validateInputValues: jest.fn(),
      materialize: jest.fn().mockImplementation((input) => ({
        sheet: input.sheet,
        computedCache: { 'uid-total': 13 },
        projection,
        palette: input.existingPalette
      }))
    }
    service = new CharacterSheetOperationService(
      repository as unknown as CharacterRepository,
      templateService as unknown as CharacterSheetTemplateService,
      materializer as unknown as SheetMaterializerService
    )
  })

  describe('hub thin API', () => {
    it('materializedだけをhub対象として返し、legacyはnullにする', async () => {
      await expect(service.getHubCharacter('character-1')).resolves.toBe(current)
      current = makeCharacter({ sheet: undefined })
      await expect(service.getHubCharacter('character-1')).resolves.toBeNull()
    })

    it('activeかつpending>appliedかつretryAt到来済みだけをworker候補にする', async () => {
      const eligible = makeCharacter({
        characterId: 'eligible',
        hub: { status: 'active', pendingRevision: 2, appliedRevision: 1 }
      })
      repository.findAll.mockResolvedValue([
        eligible,
        makeCharacter({ characterId: 'caught-up', hub: { status: 'active', pendingRevision: 2, appliedRevision: 2 } }),
        makeCharacter({
          characterId: 'future',
          hub: { status: 'active', pendingRevision: 2, appliedRevision: 1, retryAt: new Date(2_000) }
        }),
        makeCharacter({
          characterId: 'publishing',
          hub: { status: 'publishing', pendingRevision: 2, appliedRevision: 1 }
        })
      ])

      await expect(service.findHubRefreshCandidates(new Date(1_000))).resolves.toEqual([eligible])
    })

    it('hub CASをrepositoryへそのまま委譲する', async () => {
      repository.setHubState.mockResolvedValue(current)

      await service.setHubState('character-1', { status: 'none' }, { status: 'publishing', opId: 'op-1' })

      expect(repository.setHubState).toHaveBeenCalledWith(
        'character-1',
        { status: 'none' },
        { status: 'publishing', opId: 'op-1' }
      )
    })
  })

  describe('saveSheet', () => {
    it('決定表1: new==base は ignore し、DBを更新しない', async () => {
      const result = await service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 5 }]
      })

      expect(result).toEqual(expect.objectContaining({ noOp: true, appliedChanges: 0, revision: 1 }))
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it('決定表2: current==base は parts key 粒度で適用する', async () => {
      await service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 7 }]
      })

      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-score': { parts: { base: 7, buff: 0, temp: 0, other: 0 } }
          }),
          pendingRevision: 2
        }),
        1
      )
    })

    it("plain number は partsKey='base' の current として比較して parts へ昇格する", async () => {
      current = makeCharacter({
        sheet: {
          ...makeCharacter().sheet!,
          values: { ...makeCharacter().sheet!.values, 'uid-score': 5 }
        }
      })

      await service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }]
      })

      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({ 'uid-score': { parts: { base: 6 } } })
        }),
        1
      )
    })

    it('既存のサーバ生成 roll uid 値を入力境界へ再提出せず保存できる', async () => {
      materializer.validateInputValues.mockImplementation(() => {
        throw new Error('roll uid must not be validated as submitted input')
      })

      await expect(
        service.saveSheet({
          characterId: 'character-1',
          baseRevision: 1,
          changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }]
        })
      ).resolves.toEqual(expect.objectContaining({ noOp: false, revision: 2 }))
      expect(materializer.materialize).toHaveBeenCalledWith(
        expect.objectContaining({
          sheet: expect.objectContaining({ values: expect.objectContaining({ 'uid-roll': '4' }) })
        })
      )
      expect(materializer.validateInputValues).not.toHaveBeenCalled()
    })

    it('決定表3: current==new は converged no-op とし、DBを更新しない', async () => {
      const result = await service.saveSheet({
        characterId: 'character-1',
        baseRevision: 0,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 4, newValue: 5 }]
      })

      expect(result.noOp).toBe(true)
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it('決定表4: 真の競合は path/current/base/yours を含む409にする', async () => {
      const promise = service.saveSheet({
        characterId: 'character-1',
        baseRevision: 0,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 3, newValue: 7 }]
      })

      await expect(promise).rejects.toMatchObject({
        response: {
          characterId: 'character-1',
          conflicts: [
            {
              path: { fieldUid: 'uid-score', partsKey: 'base' },
              current: 5,
              base: 3,
              yours: 7
            }
          ]
        }
      })
      await expect(promise).rejects.toBeInstanceOf(ConflictException)
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it('非重複 parts 変更は先行保存後の最新値へ自動マージする', async () => {
      current = makeCharacter({
        sheet: {
          ...makeCharacter().sheet!,
          revision: 2,
          values: {
            ...makeCharacter().sheet!.values,
            'uid-score': { parts: { base: 5, buff: 0, temp: 0, other: 2 } }
          }
        }
      })

      await service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }]
      })

      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-score': { parts: { base: 6, buff: 0, temp: 0, other: 2 } }
          }),
          pendingRevision: 3
        }),
        2
      )
    })

    it('CAS 失敗時は最新を再取得して決定表から再実行する', async () => {
      const latest = makeCharacter({
        sheet: {
          ...makeCharacter().sheet!,
          revision: 2,
          values: {
            ...makeCharacter().sheet!.values,
            'uid-hp': { parts: { base: 8, buff: 0, temp: 0, other: 1 } }
          }
        }
      })
      repository.findById.mockResolvedValueOnce(current).mockResolvedValueOnce(latest)
      repository.saveSheetMaterialized
        .mockResolvedValueOnce(null)
        .mockImplementationOnce(async (_id: string, payload: SaveSheetMaterializedPayload, expectedRevision: number) =>
          makeCharacter({
            sheet: { ...latest.sheet!, revision: expectedRevision + 1, values: payload.values },
            appliedInteractionIds: payload.appliedInteractionIds
          })
        )

      const result = await service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }]
      })

      expect(result.revision).toBe(3)
      expect(repository.saveSheetMaterialized).toHaveBeenNthCalledWith(
        2,
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-hp': { parts: { base: 8, buff: 0, temp: 0, other: 1 } },
            'uid-score': { parts: { base: 6, buff: 0, temp: 0, other: 0 } }
          })
        }),
        2
      )
    })

    it('T-2a: Discord の other 保存を barrier で先行させても Web の base 変更を自動マージする', async () => {
      const deltaEntered = deferred<void>()
      const webEntered = deferred<void>()
      const deltaRelease = deferred<CharacterEntity | null>()
      const webRelease = deferred<CharacterEntity | null>()
      let deltaPayload!: SaveSheetMaterializedPayload

      repository.saveSheetMaterialized
        .mockImplementationOnce(async (_id, payload: SaveSheetMaterializedPayload) => {
          deltaPayload = payload
          deltaEntered.resolve()
          return deltaRelease.promise
        })
        .mockImplementationOnce(async () => {
          webEntered.resolve()
          return webRelease.promise
        })
        .mockImplementationOnce(async (_id, payload: SaveSheetMaterializedPayload, expectedRevision: number) => {
          current = makeCharacter({
            ...current,
            sheet: { ...current.sheet!, revision: expectedRevision + 1, values: payload.values },
            appliedInteractionIds: payload.appliedInteractionIds
          })
          return current
        })

      const deltaPromise = service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: 1,
        interaction: { id: 'interaction-barrier-delta-first' }
      })
      await deltaEntered.promise
      const webPromise = service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }]
      })
      await webEntered.promise

      current = makeCharacter({
        sheet: { ...current.sheet!, revision: 2, values: deltaPayload.values },
        appliedInteractionIds: deltaPayload.appliedInteractionIds
      })
      deltaRelease.resolve(current)
      await deltaPromise
      webRelease.resolve(null)
      await webPromise

      expect(current.sheet!.revision).toBe(3)
      expect(current.sheet!.values).toEqual(
        expect.objectContaining({
          'uid-hp': { parts: { base: 8, buff: 0, temp: 0, other: 1 } },
          'uid-score': { parts: { base: 6, buff: 0, temp: 0, other: 0 } }
        })
      )
    })

    it('T-2c: Web の base 保存を barrier で先行させても後続 Discord delta が最終状態へ収束する', async () => {
      const webEntered = deferred<void>()
      const deltaEntered = deferred<void>()
      const webRelease = deferred<CharacterEntity | null>()
      const deltaRelease = deferred<CharacterEntity | null>()
      let webPayload!: SaveSheetMaterializedPayload

      repository.saveSheetMaterialized
        .mockImplementationOnce(async (_id, payload: SaveSheetMaterializedPayload) => {
          webPayload = payload
          webEntered.resolve()
          return webRelease.promise
        })
        .mockImplementationOnce(async () => {
          deltaEntered.resolve()
          return deltaRelease.promise
        })
        .mockImplementationOnce(async (_id, payload: SaveSheetMaterializedPayload, expectedRevision: number) => {
          current = makeCharacter({
            ...current,
            sheet: { ...current.sheet!, revision: expectedRevision + 1, values: payload.values },
            appliedInteractionIds: payload.appliedInteractionIds
          })
          return current
        })

      const webPromise = service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }]
      })
      await webEntered.promise
      const deltaPromise = service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: 1,
        interaction: { id: 'interaction-barrier-web-first' }
      })
      await deltaEntered.promise

      current = makeCharacter({
        sheet: { ...current.sheet!, revision: 2, values: webPayload.values },
        appliedInteractionIds: webPayload.appliedInteractionIds
      })
      webRelease.resolve(current)
      await webPromise
      deltaRelease.resolve(null)
      await deltaPromise

      expect(current.sheet!.revision).toBe(3)
      expect(current.sheet!.values).toEqual(
        expect.objectContaining({
          'uid-hp': { parts: { base: 8, buff: 0, temp: 0, other: 1 } },
          'uid-score': { parts: { base: 6, buff: 0, temp: 0, other: 0 } }
        })
      )
    })

    it('評価・投影エラーは422にしてDBを更新しない', async () => {
      materializer.materialize.mockImplementation(() => {
        throw new Error('formula failed at uid-total')
      })

      const promise = service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }]
      })

      await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })
  })

  describe('applyResourceDelta', () => {
    it('track 境界で実効deltaへ縮退し parts.other だけへ加算する', async () => {
      const result = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: 5,
        interaction: { id: 'interaction-1' }
      })

      expect(result).toEqual(expect.objectContaining({ effectiveDelta: 2, clamped: true, noOp: false }))
      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-hp': { parts: { base: 8, buff: 0, temp: 0, other: 2 } }
          }),
          appliedInteractionIds: ['interaction-1']
        }),
        1
      )
    })

    it('既存のサーバ生成 roll uid 値があっても resource delta を保存できる', async () => {
      materializer.validateInputValues.mockImplementation(() => {
        throw new Error('roll uid must not be validated as submitted input')
      })

      await expect(
        service.applyResourceDelta({
          channelId: 'channel-1',
          paletteKey: 'resource-hp',
          delta: -1,
          interaction: { id: 'interaction-with-roll' }
        })
      ).resolves.toEqual(expect.objectContaining({ effectiveDelta: -1, noOp: false }))
      expect(materializer.materialize).toHaveBeenCalledWith(
        expect.objectContaining({
          sheet: expect.objectContaining({ values: expect.objectContaining({ 'uid-roll': '4' }) })
        })
      )
      expect(materializer.validateInputValues).not.toHaveBeenCalled()
    })

    it('effectiveDelta=0 でも interaction id を同一saveに記録する', async () => {
      const result = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: 0,
        interaction: { id: 'interaction-zero' }
      })

      expect(result.effectiveDelta).toBe(0)
      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: current.sheet!.values,
          appliedInteractionIds: ['interaction-zero']
        }),
        1
      )
    })

    it('同一 interaction.id の二重配送は加算を1回にする', async () => {
      const first = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: -1,
        interaction: { id: 'interaction-duplicate' }
      })
      const second = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: -1,
        interaction: { id: 'interaction-duplicate' }
      })

      expect(first.noOp).toBe(false)
      expect(second.noOp).toBe(true)
      expect(repository.saveSheetMaterialized).toHaveBeenCalledTimes(1)
    })

    it('21件目で最古idを押し出し、delta反映値と同じsave引数へ入れる', async () => {
      const existingIds = Array.from({ length: 20 }, (_, index) => `interaction-${index}`)
      current = makeCharacter({ appliedInteractionIds: existingIds })

      await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: -1,
        interaction: { id: 'interaction-20' }
      })

      const payload = repository.saveSheetMaterialized.mock.calls[0][1] as SaveSheetMaterializedPayload
      expect(payload.appliedInteractionIds).toEqual([...existingIds.slice(1), 'interaction-20'])
      expect(payload.values['uid-hp']).toEqual({ parts: { base: 8, buff: 0, temp: 0, other: -1 } })
    })

    it('channel projection の characterId から full document を再取得する', async () => {
      await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: -1,
        interaction: { id: 'interaction-full-fetch' }
      })

      expect(repository.findByChannelId).toHaveBeenCalledWith('channel-1')
      expect(repository.findById).toHaveBeenCalledWith('character-1')
    })
  })
})
