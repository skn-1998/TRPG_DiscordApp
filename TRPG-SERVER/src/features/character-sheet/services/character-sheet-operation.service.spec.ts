import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import * as sheetEngine from '@trpg/sheet-engine'
import type { SheetField } from '@trpg/sheet-engine'
import {
  type CharacterEntity,
  type SaveSheetMaterializedPayload
} from '../../../domains/character/models/character.entity'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { CharacterSheetTemplateRepository } from '../../../domains/character-sheet-template/repositories/character-sheet-template.repository'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import { toEngineTemplate } from '../../../domains/character-sheet-template/validation/sheet-engine-template.mapper'
import type { TemplateValidationPort } from '../../../domains/character-sheet-template/validation/template-validation.port'
import { CharacterSheetOperationService, HubProjectionPreparationError } from './character-sheet-operation.service'
import { SheetMaterializerService } from './sheet-materializer.service'

jest.mock('@trpg/sheet-engine', () => {
  const actual = jest.requireActual('@trpg/sheet-engine')
  return { ...actual, evaluateTemplate: jest.fn(actual.evaluateTemplate) }
})

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

  type PartsKeyMode = 'declared' | 'parts:true'

  const partsKeyAcceptanceCases: ReadonlyArray<{
    mode: PartsKeyMode
    partsKey: string
    accepted: boolean
  }> = [
    { mode: 'declared', partsKey: 'career', accepted: true },
    { mode: 'declared', partsKey: 'undeclared', accepted: false },
    { mode: 'declared', partsKey: 'base', accepted: true },
    { mode: 'declared', partsKey: 'other', accepted: true },
    { mode: 'declared', partsKey: '__proto__', accepted: false },
    { mode: 'declared', partsKey: 'constructor', accepted: false },
    { mode: 'declared', partsKey: 'prototype', accepted: false },
    { mode: 'declared', partsKey: '', accepted: false },
    { mode: 'parts:true', partsKey: 'career', accepted: true },
    { mode: 'parts:true', partsKey: 'undeclared', accepted: true },
    { mode: 'parts:true', partsKey: 'base', accepted: true },
    { mode: 'parts:true', partsKey: 'other', accepted: true },
    { mode: 'parts:true', partsKey: '__proto__', accepted: false },
    { mode: 'parts:true', partsKey: 'constructor', accepted: false },
    { mode: 'parts:true', partsKey: 'prototype', accepted: false },
    { mode: 'parts:true', partsKey: '', accepted: true }
  ]

  const makePartsKeyTemplate = (mode: PartsKeyMode): CharacterSheetTemplateEntity => ({
    ...template,
    sections: [
      {
        id: 'status',
        label: 'Status',
        fields: [
          mode === 'declared'
            ? {
                id: 'score',
                uid: 'uid-score',
                label: 'Score',
                type: 'scalar',
                valueType: 'number',
                partsKeys: [{ id: 'career', label: 'Career' }]
              }
            : {
                id: 'score',
                uid: 'uid-score',
                label: 'Score',
                type: 'scalar',
                valueType: 'number',
                parts: true
              }
        ]
      }
    ]
  })

  const makeOwnParts = (partsKey: string, value: number): Record<string, number> =>
    JSON.parse(`{${JSON.stringify(partsKey)}:${value}}`) as Record<string, number>

  const makeFormulaMaxTemplate = (): CharacterSheetTemplateEntity => ({
    ...template,
    sections: [
      {
        ...template.sections[0],
        fields: [
          {
            id: 'limit',
            uid: 'uid-limit',
            label: 'Limit',
            type: 'scalar',
            valueType: 'number'
          },
          ...(template.sections[0].fields as SheetField[]).map((field) =>
            field.uid === 'uid-hp' ? { ...field, max: { formula: '{status.limit}' } } : field
          )
        ]
      }
    ]
  })

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
  let templateService: { resolvePinnedRevision: jest.Mock }
  let materializer: { validateInputValues: jest.Mock; materialize: jest.Mock }
  let service: CharacterSheetOperationService

  const evaluateTemplate =
    jest.requireActual<typeof import('@trpg/sheet-engine')>('@trpg/sheet-engine').evaluateTemplate
  const evaluateTemplateMock = sheetEngine.evaluateTemplate as jest.MockedFunction<typeof sheetEngine.evaluateTemplate>
  const evaluateWithNonFiniteHp = (
    targetTemplate: Parameters<typeof evaluateTemplate>[0],
    options: Parameters<typeof evaluateTemplate>[1]
  ): ReturnType<typeof evaluateTemplate> => {
    const evaluated = evaluateTemplate(targetTemplate, options)
    return {
      ...evaluated,
      values: {
        ...evaluated.values,
        'uid-hp': { type: 'number', value: Number.POSITIVE_INFINITY }
      }
    }
  }

  const expectNonFinite422Envelope = (error: unknown, fieldUid: string): void => {
    expect(error).toBeInstanceOf(UnprocessableEntityException)
    const exception = error as UnprocessableEntityException
    expect(exception.getStatus()).toBe(422)
    expect(exception.getResponse()).toEqual({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: expect.stringContaining('有限な数値になりませんでした'),
      issues: [
        expect.objectContaining({
          fieldUid,
          path: [fieldUid],
          message: expect.stringContaining('有限な数値になりませんでした')
        })
      ]
    })
  }

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
      visibility: 'private',
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

  const makeDeprecatedPinnedOperationService = (): CharacterSheetOperationService => {
    const templateRepository = {
      findById: jest.fn().mockResolvedValue({ ...template, status: 'deprecated' })
    }
    const validationPort: TemplateValidationPort = {
      validateForSave: jest.fn(),
      validateForPublish: jest.fn()
    }
    const pinnedTemplateService = new CharacterSheetTemplateService(
      templateRepository as unknown as CharacterSheetTemplateRepository,
      validationPort
    )

    return new CharacterSheetOperationService(
      repository as unknown as CharacterRepository,
      pinnedTemplateService,
      materializer as unknown as SheetMaterializerService
    )
  }

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
    templateService = { resolvePinnedRevision: jest.fn().mockResolvedValue(template) }
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

  describe('deprecated pin regression', () => {
    it('deprecated テンプレートを pin したキャラクターの saveSheet が成功する', async () => {
      const pinnedService = makeDeprecatedPinnedOperationService()

      await expect(
        pinnedService.saveSheet({
          characterId: 'character-1',
          baseRevision: 1,
          changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }]
        })
      ).resolves.toEqual(expect.objectContaining({ noOp: false, appliedChanges: 1, revision: 2 }))
    })

    it('deprecated テンプレートを pin したキャラクターの applyResourceDelta が成功する', async () => {
      const pinnedService = makeDeprecatedPinnedOperationService()

      await expect(
        pinnedService.applyResourceDelta({
          channelId: 'channel-1',
          paletteKey: 'resource-hp',
          delta: 1,
          interaction: { id: 'interaction-deprecated-pin' }
        })
      ).resolves.toEqual(expect.objectContaining({ noOp: false, effectiveDelta: 1, revision: 2 }))
    })

    it('deprecated テンプレートを pin したキャラクターの getHubCharacter 投影が成功する', async () => {
      current = makeCharacter({ discordThreadId: 'thread-1' })
      const pinnedService = makeDeprecatedPinnedOperationService()

      await expect(pinnedService.getHubCharacter('character-1')).resolves.toEqual(
        expect.objectContaining({
          characterId: 'character-1',
          resolvedResourceValues: { 'uid-hp': 8 }
        })
      )
    })
  })

  describe('hub thin API', () => {
    it('materializedだけをhub対象として返し、legacyはnullにする', async () => {
      current = makeCharacter({ discordThreadId: 'thread-1' })
      await expect(service.getHubCharacter('character-1')).resolves.toEqual(
        expect.objectContaining({
          characterId: current.characterId,
          resolvedResourceValues: { 'uid-hp': 8 }
        })
      )
      current = makeCharacter({ sheet: undefined })
      await expect(service.getHubCharacter('character-1')).resolves.toBeNull()
    })

    it('thread未確定のpoll snapshotではresource値を解決しない', async () => {
      await expect(service.getHubCharacter('character-1')).resolves.toBe(current)
      expect(templateService.resolvePinnedRevision).not.toHaveBeenCalled()
    })

    it('hub noneはthread確定後もpublication CASまでテンプレートを解決しない', async () => {
      current = makeCharacter({
        discordThreadId: 'thread-1',
        hub: { status: 'none', pendingRevision: 1, appliedRevision: 0 }
      })
      templateService.resolvePinnedRevision.mockRejectedValue(
        new ConflictException('sheet template must be published at the requested version')
      )

      await expect(service.getHubCharacter('character-1')).resolves.toBe(current)
      expect(templateService.resolvePinnedRevision).not.toHaveBeenCalled()
    })

    it('activeかつpending>appliedかつ429のretryAt到来済みだけをworker候補にする', async () => {
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

    it('publishing snapshotにも解決済みresource値を付与する', async () => {
      repository.setHubState.mockResolvedValue(current)

      const publishing = await service.setHubState(
        'character-1',
        { status: 'none' },
        { status: 'publishing', opId: 'op-1' }
      )

      expect(publishing).toEqual(
        expect.objectContaining({
          resolvedResourceValues: { 'uid-hp': 8 }
        })
      )
    })

    it('publishing時のresource値解決失敗を握り潰さずcallerへ返す', async () => {
      const resolutionError = new ConflictException('published template is deprecated')
      repository.setHubState.mockResolvedValue(current)
      templateService.resolvePinnedRevision.mockRejectedValue(resolutionError)

      await expect(
        service.setHubState('character-1', { status: 'none' }, { status: 'publishing', opId: 'op-1' })
      ).rejects.toBe(resolutionError)
    })

    it('formula max=10・parts合計12のhub resource値を10へクランプする', async () => {
      templateService.resolvePinnedRevision.mockResolvedValue(makeFormulaMaxTemplate())
      current = makeCharacter({
        discordThreadId: 'thread-1',
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-limit': 10,
            'uid-hp': { parts: { base: 12 } }
          }
        }
      })

      await expect(service.getHubCharacter('character-1')).resolves.toEqual(
        expect.objectContaining({
          resolvedResourceValues: expect.objectContaining({ 'uid-hp': 10 })
        })
      )
    })

    it('hub resource の非有限422原因にも会計済み封筒全体を保持する', async () => {
      evaluateTemplateMock.mockImplementationOnce(evaluateWithNonFiniteHp)
      current = makeCharacter({
        discordThreadId: 'thread-1'
      })
      let failure: unknown

      try {
        await service.getHubCharacter('character-1')
      } catch (error) {
        failure = error
      }
      evaluateTemplateMock.mockImplementation(evaluateTemplate)

      expect(failure).toBeInstanceOf(HubProjectionPreparationError)
      expectNonFinite422Envelope((failure as HubProjectionPreparationError).projectionCause, 'uid-hp')
    })

    it('palette対象外のresource text scalarがあってもhub投影値の解決に成功する', async () => {
      const textResourceField: SheetField = {
        id: 'condition',
        uid: 'uid-condition',
        label: 'Condition',
        type: 'scalar',
        valueType: 'text',
        role: { kind: 'resource', deltas: [-1, 1] }
      }
      templateService.resolvePinnedRevision.mockResolvedValue({
        ...template,
        sections: [
          {
            ...template.sections[0],
            fields: [...(template.sections[0].fields as SheetField[]), textResourceField]
          }
        ]
      })
      current = makeCharacter({
        discordThreadId: 'thread-1',
        sheet: {
          ...current.sheet!,
          values: { ...current.sheet!.values, 'uid-condition': 'resting' }
        }
      })

      await expect(service.getHubCharacter('character-1')).resolves.toEqual(
        expect.objectContaining({
          resolvedResourceValues: { 'uid-hp': 8 }
        })
      )
    })

    it('max依存値を縮小して保存した直後のhub resource値を新maxへクランプする', async () => {
      templateService.resolvePinnedRevision.mockResolvedValue(makeFormulaMaxTemplate())
      current = makeCharacter({
        discordThreadId: 'thread-1',
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-limit': 10,
            'uid-hp': { parts: { base: 8 } }
          }
        }
      })

      await service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-limit' }, baseValue: 10, newValue: 5 }]
      })

      await expect(service.getHubCharacter('character-1')).resolves.toEqual(
        expect.objectContaining({
          resolvedResourceValues: expect.objectContaining({ 'uid-hp': 5 })
        })
      )
      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({ 'uid-hp': { parts: { base: 8 } }, 'uid-limit': 5 })
        }),
        1
      )
    })

    it('characterIdからactive hubを再取得し、messageId付きCASでerrorへ遷移する', async () => {
      current = makeCharacter({
        hub: {
          status: 'active',
          messageId: 'message-1',
          threadId: 'thread-1',
          pendingRevision: 2,
          appliedRevision: 1
        }
      })
      repository.setHubState.mockResolvedValue({
        ...current,
        hub: { status: 'error', errorCode: 'PROJECTION_FAILED' }
      })

      await expect(service.markHubRefreshError('character-1', 'PROJECTION_FAILED')).resolves.toBe('marked')

      expect(repository.setHubState).toHaveBeenCalledWith(
        'character-1',
        { status: 'active', messageId: 'message-1' },
        { status: 'error', errorCode: 'PROJECTION_FAILED' }
      )
      expect(templateService.resolvePinnedRevision).not.toHaveBeenCalled()
    })

    it('最新hubがcatch-up済みならerrorへ遷移しない', async () => {
      current = makeCharacter({
        hub: {
          status: 'active',
          messageId: 'message-1',
          threadId: 'thread-1',
          pendingRevision: 2,
          appliedRevision: 2
        }
      })

      await expect(service.markHubRefreshError('character-1', 'PROJECTION_FAILED')).resolves.toBe('not-applicable')

      expect(repository.setHubState).not.toHaveBeenCalled()
    })

    it('error遷移のCASが一致しなければcas-failedを返す', async () => {
      current = makeCharacter({
        hub: {
          status: 'active',
          messageId: 'message-1',
          threadId: 'thread-1',
          pendingRevision: 2,
          appliedRevision: 1
        }
      })
      repository.setHubState.mockResolvedValue(null)

      await expect(service.markHubRefreshError('character-1', 'PROJECTION_FAILED')).resolves.toBe('cas-failed')
    })

    it.each([
      [{ status: 'none' } as const, { status: 'active', messageId: 'm1' } as const],
      [{ status: 'none' } as const, { status: 'publishing' } as const],
      [{ status: 'publishing', opId: 'op-1' } as const, { status: 'active' } as const],
      [{ status: 'active', messageId: 'm1' } as const, { status: 'none' } as const]
    ])('合法集合外または必須marker不足のhub遷移をrepository呼出前に拒否する', async (from, to) => {
      expect(() => service.setHubState('character-1', from, to)).toThrow()
      expect(repository.setHubState).not.toHaveBeenCalled()
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

    it('値 diff の materialize で public visibility を保持する', async () => {
      current = makeCharacter({ sheet: { ...makeCharacter().sheet!, visibility: 'public' } })

      await service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 7 }]
      })

      expect(materializer.materialize).toHaveBeenCalledWith(
        expect.objectContaining({ sheet: expect.objectContaining({ visibility: 'public' }) })
      )
      expect(current.sheet?.visibility).toBe('public')
    })

    it("partsKey='__proto__' は422で拒否し、値の書き込みも保存もしない", async () => {
      const before = current.sheet!.values['uid-score']

      const promise = service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: '__proto__' }, baseValue: undefined, newValue: 1 }]
      })

      await expect(promise).rejects.toMatchObject({ status: 422 })
      expect(current.sheet!.values['uid-score']).toEqual(before)
      expect(materializer.materialize).not.toHaveBeenCalled()
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it('宣言モードの undeclared partsKey は422で拒否し、保存しない', async () => {
      templateService.resolvePinnedRevision.mockResolvedValue(makePartsKeyTemplate('declared'))

      const promise = service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'undeclared' }, baseValue: undefined, newValue: 1 }]
      })

      await expect(promise).rejects.toMatchObject({ status: 422 })
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it('宣言モードの declared partsKey は適用して保存する', async () => {
      templateService.resolvePinnedRevision.mockResolvedValue(makePartsKeyTemplate('declared'))
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: { ...current.sheet!.values, 'uid-score': { parts: { career: 0 } } }
        }
      })

      await expect(
        service.saveSheet({
          characterId: 'character-1',
          baseRevision: 1,
          changes: [{ path: { fieldUid: 'uid-score', partsKey: 'career' }, baseValue: 0, newValue: 1 }]
        })
      ).resolves.toEqual(expect.objectContaining({ noOp: false, appliedChanges: 1, revision: 2 }))
      expect(repository.saveSheetMaterialized).toHaveBeenCalledTimes(1)
    })

    // partsKey 受理の層間一致は、ケース表 partsKeyAcceptanceCases を受理系/拒否系に分けて検証する。
    // （1 本の it.each に畳むと期待値が if 分岐に入り jest/no-conditional-expect に触れるため）
    const arrangePartsKeyCase = (mode: PartsKeyMode): CharacterSheetTemplateEntity => {
      const partsKeyTemplate = makePartsKeyTemplate(mode)
      templateService.resolvePinnedRevision.mockResolvedValue(partsKeyTemplate)
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: { ...current.sheet!.values, 'uid-score': { parts: {} } }
        }
      })
      return partsKeyTemplate
    }

    const engineAcceptsPartsKey = (partsKeyTemplate: CharacterSheetTemplateEntity, partsKey: string): boolean =>
      sheetEngine
        .buildValueInputSchema(toEngineTemplate(partsKeyTemplate))
        .safeParse({ 'uid-score': { parts: makeOwnParts(partsKey, 1) } }).success

    it.each(partsKeyAcceptanceCases.filter((testCase) => testCase.accepted))(
      'engine入力境界と操作層のpartsKey受理を一致させる(受理): $mode / "$partsKey"',
      async ({ mode, partsKey }) => {
        const partsKeyTemplate = arrangePartsKeyCase(mode)

        expect(engineAcceptsPartsKey(partsKeyTemplate, partsKey)).toBe(true)

        await expect(
          service.saveSheet({
            characterId: 'character-1',
            baseRevision: 1,
            changes: [{ path: { fieldUid: 'uid-score', partsKey }, baseValue: undefined, newValue: 1 }]
          })
        ).resolves.toEqual(expect.objectContaining({ noOp: false, appliedChanges: 1, revision: 2 }))
        expect(repository.saveSheetMaterialized).toHaveBeenCalledTimes(1)
      }
    )

    it.each(partsKeyAcceptanceCases.filter((testCase) => !testCase.accepted))(
      'engine入力境界と操作層のpartsKey受理を一致させる(拒否): $mode / "$partsKey"',
      async ({ mode, partsKey }) => {
        const partsKeyTemplate = arrangePartsKeyCase(mode)

        expect(engineAcceptsPartsKey(partsKeyTemplate, partsKey)).toBe(false)

        await expect(
          service.saveSheet({
            characterId: 'character-1',
            baseRevision: 1,
            changes: [{ path: { fieldUid: 'uid-score', partsKey }, baseValue: undefined, newValue: 1 }]
          })
        ).rejects.toMatchObject({ status: 422 })
        expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
      }
    )

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

    it('実materializerで範囲外legacy partsを投影だけ正規化し、保存値を維持する', async () => {
      const legacyHp = { parts: { base: 999, buff: 0, temp: 0, other: 0 } }
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: { ...current.sheet!.values, 'uid-hp': legacyHp }
        }
      })
      service = new CharacterSheetOperationService(
        repository as unknown as CharacterRepository,
        templateService as unknown as CharacterSheetTemplateService,
        new SheetMaterializerService()
      )

      await expect(
        service.saveSheet({
          characterId: 'character-1',
          baseRevision: 1,
          changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 7 }]
        })
      ).resolves.toEqual(expect.objectContaining({ noOp: false, revision: 2 }))

      const payload = repository.saveSheetMaterialized.mock.calls[0][1] as SaveSheetMaterializedPayload
      expect(payload.values['uid-hp']).toEqual(legacyHp)
      expect(payload.status.hp).toEqual(expect.objectContaining({ values: { base: 10 } }))
      expect(payload.palette).toEqual([
        expect.objectContaining({ fieldRef: { uid: 'uid-hp' }, label: 'HP (10)', kind: 'resource' })
      ])
    })

    it('hp.maxがCONを参照していても、CONだけを12から11へ下げる保存は成功する', async () => {
      const hpByConTemplate: CharacterSheetTemplateEntity = {
        ...template,
        sections: [
          {
            ...template.sections[0],
            fields: (template.sections[0].fields as SheetField[]).map((field) =>
              field.uid === 'uid-hp' ? { ...field, max: { formula: '{parameter.con}' } } : field
            )
          },
          {
            id: 'parameter',
            label: 'Parameter',
            fields: [
              {
                id: 'con',
                uid: 'uid-con',
                label: 'CON',
                type: 'scalar',
                valueType: 'number'
              }
            ]
          }
        ]
      }
      templateService.resolvePinnedRevision.mockResolvedValue(hpByConTemplate)
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-hp': { parts: { base: 12, other: 0 } },
            'uid-con': 12
          }
        }
      })

      await expect(
        service.saveSheet({
          characterId: 'character-1',
          baseRevision: 1,
          changes: [{ path: { fieldUid: 'uid-con' }, baseValue: 12, newValue: 11 }]
        })
      ).resolves.toEqual(expect.objectContaining({ noOp: false, revision: 2 }))

      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-hp': { parts: { base: 12, other: 0 } },
            'uid-con': 11
          })
        }),
        1
      )
    })

    it.each([
      ['plain number', 999],
      ['parts total', { parts: { base: 999, other: 0 } }]
    ])('formula maxを外れる新規track書き込みを422にする: %s', async (_caseName, newValue) => {
      templateService.resolvePinnedRevision.mockResolvedValue(makeFormulaMaxTemplate())
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: { ...current.sheet!.values, 'uid-limit': 10 }
        }
      })
      const baseValue = current.sheet!.values['uid-hp']

      const promise = service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-hp' }, baseValue, newValue }]
      })

      await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it.each([
      ['plain numberでmax側からmin側', 12, -1],
      ['plain numberでmin側からmax側', -2, 11],
      ['partsでmax側からmin側', { parts: { base: 12 } }, { parts: { base: -1 } }],
      ['partsでmin側からmax側', { parts: { base: -2 } }, { parts: { base: 11 } }]
    ])('反対側への範囲外書き込みを422にして保存しない: %s', async (_caseName, currentValue, newValue) => {
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: { ...current.sheet!.values, 'uid-hp': currentValue }
        }
      })

      const promise = service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-hp' }, baseValue: currentValue, newValue }]
      })

      await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
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

    it('決定表4: 真の競合は保存済み revision と path/current/base/yours を含む409にする', async () => {
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          revision: 4
        }
      })
      const expectedCurrentRevision = current.sheet!.revision
      const promise = service.saveSheet({
        characterId: 'character-1',
        baseRevision: 0,
        changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 3, newValue: 7 }]
      })

      await expect(promise).rejects.toMatchObject({
        response: {
          characterId: 'character-1',
          currentRevision: expectedCurrentRevision,
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

    it('mine は conflict の currentRevision と current を base にして再送すると保存できる', async () => {
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          revision: 4
        }
      })
      const conflict = await service
        .saveSheet({
          characterId: 'character-1',
          baseRevision: 0,
          changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 3, newValue: 7 }]
        })
        .catch((error: unknown) => error)

      expect(conflict).toBeInstanceOf(ConflictException)
      const payload = (conflict as ConflictException).getResponse() as {
        currentRevision: number
        conflicts: Array<{
          path: { fieldUid: string; partsKey?: string }
          current: unknown
          yours: unknown
        }>
      }
      const conflictEntry = payload.conflicts[0]!

      await expect(
        service.saveSheet({
          characterId: 'character-1',
          baseRevision: payload.currentRevision,
          changes: [
            {
              path: conflictEntry.path,
              baseValue: conflictEntry.current,
              newValue: conflictEntry.yours
            }
          ]
        })
      ).resolves.toEqual(
        expect.objectContaining({
          noOp: false,
          revision: payload.currentRevision + 1
        })
      )
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
    it('更新前resourceの非有限422に会計済み封筒全体を渡す', async () => {
      evaluateTemplateMock.mockImplementationOnce(evaluateWithNonFiniteHp)
      let failure: unknown

      try {
        await service.applyResourceDelta({
          channelId: 'channel-1',
          paletteKey: 'resource-hp',
          delta: -1,
          interaction: { id: 'interaction-non-finite-before' }
        })
      } catch (error) {
        failure = error
      }
      evaluateTemplateMock.mockImplementation(evaluateTemplate)

      expectNonFinite422Envelope(failure, 'uid-hp')
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it('delta適用後resourceの非有限422に会計済み封筒全体を渡す', async () => {
      evaluateTemplateMock
        .mockImplementationOnce((targetTemplate, options) => evaluateTemplate(targetTemplate, options))
        .mockImplementationOnce(evaluateWithNonFiniteHp)
      let failure: unknown

      try {
        await service.applyResourceDelta({
          channelId: 'channel-1',
          paletteKey: 'resource-hp',
          delta: -1,
          interaction: { id: 'interaction-non-finite-after' }
        })
      } catch (error) {
        failure = error
      }
      evaluateTemplateMock.mockImplementation(evaluateTemplate)

      expectNonFinite422Envelope(failure, 'uid-hp')
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it('minとmaxが同じ縮退trackでは境界方向を特定しない', async () => {
      templateService.resolvePinnedRevision.mockResolvedValue({
        ...template,
        sections: [
          {
            ...template.sections[0],
            fields: (template.sections[0].fields as SheetField[]).map((field) =>
              field.uid === 'uid-hp' ? { ...field, min: 5, max: 5 } : field
            )
          }
        ]
      })
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-hp': { parts: { base: 5, other: 0 } }
          }
        }
      })

      const result = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: -1,
        interaction: { id: 'interaction-degenerate-range' }
      })

      expect(result).toEqual(
        expect.objectContaining({
          beforeEffectiveValue: 5,
          afterEffectiveValue: 5,
          atBound: null
        })
      )
    })

    it('track 境界で実効deltaへ縮退し parts.other だけへ加算する', async () => {
      const result = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: 5,
        interaction: { id: 'interaction-1' }
      })

      expect(result).toEqual(
        expect.objectContaining({
          effectiveDelta: 2,
          clamped: true,
          noOp: false,
          beforeEffectiveValue: 8,
          afterEffectiveValue: 10,
          atBound: 'max'
        })
      )
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

    it('mp.maxがHPを参照していても、HPの-1更新は成功する', async () => {
      const mpField = {
        id: 'mp',
        uid: 'uid-mp',
        label: 'MP',
        type: 'track' as const,
        min: 0,
        max: { formula: '{status.hp}' },
        style: 'gauge' as const
      }
      templateService.resolvePinnedRevision.mockResolvedValue({
        ...template,
        sections: [
          {
            ...template.sections[0],
            fields: [...(template.sections[0].fields as SheetField[]), mpField]
          }
        ]
      })
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-hp': { parts: { base: 10, other: 0 } },
            'uid-mp': { parts: { base: 10, other: 0 } }
          }
        }
      })

      await expect(
        service.applyResourceDelta({
          channelId: 'channel-1',
          paletteKey: 'resource-hp',
          delta: -1,
          interaction: { id: 'interaction-hp-lowers-mp-max' }
        })
      ).resolves.toEqual(
        expect.objectContaining({ beforeEffectiveValue: 10, afterEffectiveValue: 9, effectiveDelta: -1 })
      )

      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-hp': { parts: { base: 10, other: -1 } },
            'uid-mp': { parts: { base: 10, other: 0 } }
          })
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
      current = {
        ...current,
        palette: (current.palette ?? []).map((entry) =>
          entry.kind === 'resource' ? { ...entry, deltas: [...entry.deltas, 0] } : entry
        )
      }

      const result = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: 0,
        interaction: { id: 'interaction-zero' }
      })

      expect(result.effectiveDelta).toBe(0)
      expect(result).toEqual(
        expect.objectContaining({ beforeEffectiveValue: 8, afterEffectiveValue: 8, atBound: null })
      )
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
      expect(second).toEqual(
        expect.objectContaining({ beforeEffectiveValue: null, afterEffectiveValue: null, atBound: null })
      )
      expect(repository.saveSheetMaterialized).toHaveBeenCalledTimes(1)
    })

    it('未宣言deltaはresource palette entry not foundとして保存しない', async () => {
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-hp': { parts: { base: 999, buff: 0, temp: 0, other: 0 } }
          }
        }
      })

      const failure = await service
        .applyResourceDelta({
          channelId: 'channel-1',
          paletteKey: 'resource-hp',
          delta: -3,
          interaction: { id: 'interaction-undeclared-legacy-high' }
        })
        .catch((error: unknown) => error)

      expect(failure).toBeInstanceOf(NotFoundException)
      expect((failure as NotFoundException).message).toBe('resource palette entry not found')
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it('宣言集合変更後のstale deltaはresource palette entry not foundとして保存しない', async () => {
      current = {
        ...current,
        palette: (current.palette ?? []).map((entry) => (entry.kind === 'resource' ? { ...entry, deltas: [1] } : entry))
      }

      const failure = await service
        .applyResourceDelta({
          channelId: 'channel-1',
          paletteKey: 'resource-hp',
          delta: -1,
          interaction: { id: 'interaction-stale-delta' }
        })
        .catch((error: unknown) => error)

      expect(failure).toBeInstanceOf(NotFoundException)
      expect((failure as NotFoundException).message).toBe('resource palette entry not found')
      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    })

    it('宣言済みdeltaは従来どおり適用して保存する', async () => {
      const result = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: -1,
        interaction: { id: 'interaction-declared-delta' }
      })

      expect(result).toEqual(expect.objectContaining({ noOp: false, effectiveDelta: -1 }))
      expect(repository.saveSheetMaterialized).toHaveBeenCalledTimes(1)
    })

    it('範囲外legacy partsへの宣言済み-5は保存しつつ実効値がmaxのまま変わらないと返す', async () => {
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-hp': { parts: { base: 999, buff: 0, temp: 0, other: 0 } }
          }
        }
      })

      const result = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: -5,
        interaction: { id: 'interaction-declared-legacy-high' }
      })

      expect(result).toEqual(
        expect.objectContaining({
          noOp: false,
          effectiveDelta: -5,
          beforeEffectiveValue: 10,
          afterEffectiveValue: 10,
          atBound: 'max'
        })
      )
      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-hp': { parts: { base: 999, buff: 0, temp: 0, other: -5 } }
          })
        }),
        1
      )
      expect(materializer.materialize).toHaveBeenCalledWith(
        expect.objectContaining({
          sheet: expect.objectContaining({
            values: expect.objectContaining({ 'uid-hp': 10 })
          })
        })
      )
    })

    it('min未満legacy partsへの+3は保存しつつ実効値がminのまま変わらないと返す', async () => {
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-hp': { parts: { base: -999, buff: 0, temp: 0, other: 0 } }
          }
        },
        palette: (current.palette ?? []).map((entry) =>
          entry.kind === 'resource' ? { ...entry, deltas: [...entry.deltas, 3] } : entry
        )
      })

      const result = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: 3,
        interaction: { id: 'interaction-legacy-low' }
      })

      expect(result).toEqual(
        expect.objectContaining({
          noOp: false,
          effectiveDelta: 3,
          beforeEffectiveValue: 0,
          afterEffectiveValue: 0,
          atBound: 'min'
        })
      )
      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-hp': { parts: { base: -999, buff: 0, temp: 0, other: 3 } }
          })
        }),
        1
      )
    })

    it('formula max範囲外のlegacy partsは±1で巨大な逆向きdeltaを作らず、実効値不変を返す', async () => {
      templateService.resolvePinnedRevision.mockResolvedValue(makeFormulaMaxTemplate())
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-limit': 10,
            'uid-hp': { parts: { base: 999, other: 0 } }
          }
        }
      })
      materializer.materialize.mockImplementation((input) => {
        if (typeof input.sheet.values['uid-hp'] !== 'number') {
          throw new Error('out-of-range formula-max parts reached materializer')
        }
        return {
          sheet: input.sheet,
          computedCache: { 'uid-total': 15 },
          projection,
          palette: input.existingPalette
        }
      })

      const increment = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: 1,
        interaction: { id: 'interaction-formula-legacy-plus' }
      })
      const decrement = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-hp',
        delta: -1,
        interaction: { id: 'interaction-formula-legacy-minus' }
      })

      expect(increment).toEqual(
        expect.objectContaining({
          effectiveDelta: 0,
          beforeEffectiveValue: 10,
          afterEffectiveValue: 10,
          atBound: 'max'
        })
      )
      expect(decrement).toEqual(
        expect.objectContaining({
          effectiveDelta: -1,
          beforeEffectiveValue: 10,
          afterEffectiveValue: 10,
          atBound: 'max'
        })
      )
      expect(decrement.effectiveDelta).not.toBe(-989)
      expect(materializer.materialize).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          sheet: expect.objectContaining({ values: expect.objectContaining({ 'uid-hp': 10 }) })
        })
      )
      expect(materializer.materialize).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sheet: expect.objectContaining({ values: expect.objectContaining({ 'uid-hp': 10 }) })
        })
      )
      expect(repository.saveSheetMaterialized).toHaveBeenLastCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-hp': { parts: { base: 999, other: -1 } }
          })
        }),
        2
      )
    })

    it('別trackが範囲外でも対象resourceの実効値を更新し、legacy partsは保持する', async () => {
      const mpField = {
        id: 'mp',
        uid: 'uid-mp',
        label: 'MP',
        type: 'track' as const,
        min: 0,
        max: 10,
        style: 'gauge' as const,
        role: { kind: 'resource' as const, deltas: [-1, 1] }
      }
      templateService.resolvePinnedRevision.mockResolvedValue({
        ...template,
        sections: [
          {
            ...template.sections[0],
            fields: [...(template.sections[0].fields as SheetField[]), mpField]
          }
        ]
      })
      current = makeCharacter({
        sheet: {
          ...current.sheet!,
          values: {
            ...current.sheet!.values,
            'uid-hp': { parts: { base: 999 } },
            'uid-mp': { parts: { base: 5, other: 0 } }
          }
        },
        palette: [
          ...(current.palette ?? []),
          {
            key: 'resource-mp',
            fieldRef: { uid: 'uid-mp' },
            label: 'MP (5)',
            kind: 'resource',
            deltas: [-1, 1],
            group: 'Status'
          }
        ]
      })

      const result = await service.applyResourceDelta({
        channelId: 'channel-1',
        paletteKey: 'resource-mp',
        delta: -1,
        interaction: { id: 'interaction-other-legacy-high' }
      })

      expect(result).toEqual(expect.objectContaining({ beforeEffectiveValue: 5, afterEffectiveValue: 4 }))
      expect(materializer.materialize).toHaveBeenCalledWith(
        expect.objectContaining({
          sheet: expect.objectContaining({
            values: expect.objectContaining({
              'uid-hp': 10,
              'uid-mp': { parts: { base: 5, other: -1 } }
            })
          })
        })
      )
      expect(repository.saveSheetMaterialized).toHaveBeenCalledWith(
        'character-1',
        expect.objectContaining({
          values: expect.objectContaining({
            'uid-hp': { parts: { base: 999 } },
            'uid-mp': { parts: { base: 5, other: -1 } }
          })
        }),
        1
      )
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
