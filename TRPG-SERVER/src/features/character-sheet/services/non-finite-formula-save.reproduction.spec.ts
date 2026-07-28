import { ExecutionContext, INestApplication, UnprocessableEntityException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { validatePublishTemplate } from '@trpg/sheet-engine'
import type { SheetField } from '@trpg/sheet-engine'
import { Request } from 'express'
import request from 'supertest'
import { AppConfigService } from '../../../config/config.service'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import type { CharacterEntity } from '../../../domains/character/models/character.entity'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import { JwtAuthGuard } from '../../../domains/auth/guards/jwt-auth.guard'
import { APP_GLOBAL_EXCEPTION_FILTER_PROVIDER } from '../../../core/http/global-exception.filter'
import { APP_VALIDATION_PIPE_PROVIDER } from '../../../core/http/validation-pipe.provider'
import {
  CHARACTER_INSTANTIATION_USE_CASE,
  CHARACTER_SHEET_OPERATION_USE_CASE,
  CharacterSheetController
} from '../../../domains/character/character.controller'
import { CharacterService } from '../../../domains/character/character.service'
import { CharacterSheetOperationService, SaveSheetInput } from './character-sheet-operation.service'
import { SheetMaterializerService } from './sheet-materializer.service'
import { type BoundedNonFiniteErrorEnvelope, nonFiniteHttpBodyBytes } from './track-range.policy'

describe('non-finite formula save reproduction', () => {
  const formula = '{parameter.numerator} / {parameter.denominator}'
  const infinityMessage =
    '計算式の結果が有限な数値になりませんでした（フィールド: uid-quotient / ラベル: Quotient / 式: {parameter.numerator} / {parameter.denominator} / 結果: Infinity）。ゼロ除算などが起きていないか式を確認してください'

  const templateFields: SheetField[] = [
    {
      id: 'numerator',
      uid: 'uid-numerator',
      label: 'Numerator',
      type: 'scalar',
      valueType: 'number'
    },
    {
      id: 'denominator',
      uid: 'uid-denominator',
      label: 'Denominator',
      type: 'scalar',
      valueType: 'number'
    },
    {
      id: 'quotient',
      uid: 'uid-quotient',
      label: 'Quotient',
      type: 'computed',
      resultType: 'number',
      formula
    }
  ]

  const template: CharacterSheetTemplateEntity = {
    templateId: 'division-by-zero-template',
    status: 'published',
    version: '1.0.0',
    schemaVersion: 3,
    name: 'Division by zero',
    gameSystemId: 'DiceBot',
    tags: [],
    visibility: 'public',
    authorDiscordUserId: 'owner-1',
    sections: [
      {
        id: 'parameter',
        label: 'Parameter',
        fields: templateFields
      }
    ],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  const character: CharacterEntity = {
    characterId: 'character-1',
    characterName: 'Alice',
    gameSystemId: 'DiceBot',
    discordUserId: 'owner-1',
    discordChannelId: 'channel-1',
    status: {},
    parameter: {
      numerator: { name: 'Numerator', index: 0, values: { base: 1 }, isVisible: true },
      denominator: { name: 'Denominator', index: 1, values: { base: 1 }, isVisible: true },
      quotient: { name: 'Quotient', index: 2, values: { base: 1 }, isVisible: true }
    },
    skill: {},
    item: {},
    description: {},
    sheet: {
      templateId: template.templateId,
      templateVersion: template.version,
      revision: 1,
      values: {
        'uid-numerator': 1,
        'uid-denominator': 1
      }
    },
    computedCache: { 'uid-quotient': 1 },
    palette: [],
    hub: { status: 'none', pendingRevision: 1, appliedRevision: 1 },
    appliedInteractionIds: []
  }

  const saveInput: SaveSheetInput = {
    characterId: character.characterId,
    baseRevision: 1,
    changes: [{ path: { fieldUid: 'uid-denominator' }, baseValue: 1, newValue: 0 }]
  }

  const expectedFailureResponse = {
    statusCode: 422,
    error: 'Unprocessable Entity',
    message: infinityMessage,
    issues: [
      {
        fieldUid: 'uid-quotient',
        path: ['uid-quotient'],
        message: infinityMessage
      }
    ]
  }

  const createOperationService = (
    repository: {
      findById: jest.Mock
      saveSheetMaterialized: jest.Mock
    },
    resolvedTemplate: CharacterSheetTemplateEntity = template
  ): CharacterSheetOperationService => {
    const templateService = {
      resolvePublished: jest.fn().mockResolvedValue(resolvedTemplate)
    }
    return new CharacterSheetOperationService(
      repository as unknown as CharacterRepository,
      templateService as unknown as CharacterSheetTemplateService,
      new SheetMaterializerService()
    )
  }

  const createHttpApp = async (
    operationService: CharacterSheetOperationService,
    currentCharacter: CharacterEntity
  ): Promise<INestApplication> => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterSheetController],
      providers: [
        {
          provide: CharacterService,
          useValue: { findOneForOwner: jest.fn().mockResolvedValue(currentCharacter) }
        },
        { provide: CHARACTER_SHEET_OPERATION_USE_CASE, useValue: operationService },
        { provide: CHARACTER_INSTANTIATION_USE_CASE, useValue: { instantiate: jest.fn() } },
        // 実 AppConfigModule を import せず、filter が読む app.environment だけを決定的にして env 依存を持ち込まない。
        { provide: AppConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
        APP_VALIDATION_PIPE_PROVIDER,
        APP_GLOBAL_EXCEPTION_FILTER_PROVIDER
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<Request>()
          req.user = { username: 'Alice', discordUserId: 'owner-1' }
          return true
        }
      })
      .compile()

    const app: INestApplication = module.createNestApplication()
    await app.init()
    return app
  }

  const expectNonFiniteFailure = async (
    operationService: CharacterSheetOperationService,
    input: SaveSheetInput,
    expectedResult: 'NaN' | '-Infinity'
  ): Promise<void> => {
    let failure: unknown
    try {
      await operationService.saveSheet(input)
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const response = (failure as UnprocessableEntityException).getResponse() as {
      statusCode: number
      message: string
      issues: Array<{ fieldUid?: string; path: string[]; message: string }>
    }
    expect(response.statusCode).toBe(422)
    expect(response.message).toContain('uid-quotient')
    expect(response.message).toContain(formula)
    expect(response.message).toContain(`結果: ${expectedResult}`)
    expect(response.issues).toEqual([
      expect.objectContaining({
        fieldUid: 'uid-quotient',
        path: ['uid-quotient'],
        message: expect.stringContaining(`結果: ${expectedResult}`)
      })
    ])
  }

  it('publish は通るが、ゼロ除算を生む保存は原因を含む 422 になり repository へ到達しない', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(character),
      saveSheetMaterialized: jest.fn()
    }
    const operationService = createOperationService(repository)

    expect(validatePublishTemplate(template)).toEqual(expect.objectContaining({ ok: true, issues: [] }))

    let failure: unknown
    try {
      await operationService.saveSheet(saveInput)
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const exception = failure as UnprocessableEntityException
    expect(exception.message).toBe(infinityMessage)
    expect(exception.getResponse()).toEqual(expectedFailureResponse)
    expect(JSON.stringify(exception.getResponse())).not.toMatch(
      /Character sheet values are invalid|projection\.parameter is not a canonical AttributeSection/
    )

    const characterService = {
      findOneForOwner: jest.fn().mockResolvedValue(character)
    }
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterSheetController],
      providers: [
        { provide: CharacterService, useValue: characterService },
        { provide: CHARACTER_SHEET_OPERATION_USE_CASE, useValue: operationService },
        { provide: CHARACTER_INSTANTIATION_USE_CASE, useValue: { instantiate: jest.fn() } },
        // 実 AppConfigModule を import せず、filter が読む app.environment だけを決定的にして env 依存を持ち込まない。
        { provide: AppConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
        // whitelist 専用 test の移設後も、production と同じ HTTP pipe 経路の忠実性を保つため登録を維持する。
        APP_VALIDATION_PIPE_PROVIDER,
        APP_GLOBAL_EXCEPTION_FILTER_PROVIDER
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<Request>()
          req.user = { username: 'Alice', discordUserId: 'owner-1' }
          return true
        }
      })
      .compile()

    const app: INestApplication = module.createNestApplication()
    await app.init()
    try {
      // NOTE: global filter が HttpException の直列化を変えて期待 body（issues[] を含む）を壊すと本 spec が赤になる。
      const response = await request(app.getHttpServer())
        .put(`/character/${character.characterId}/sheet`)
        .send({ baseRevision: saveInput.baseRevision, changes: saveInput.changes })
        .expect(422)

      expect(response.body).toEqual(expectedFailureResponse)
    } finally {
      await app.close()
    }

    expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
  })

  it('最終 wire モデルは固定 diagnostic 1 件の現行 Nest HTTP body 以上を会計する', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(character),
      saveSheetMaterialized: jest.fn()
    }
    const operationService = createOperationService(repository)
    const app = await createHttpApp(operationService, character)

    try {
      const response = await request(app.getHttpServer())
        .put(`/character/${character.characterId}/sheet`)
        .send({ baseRevision: saveInput.baseRevision, changes: saveInput.changes })
        .expect(422)
      const actualBodyBytes = Buffer.byteLength(response.text, 'utf8')
      const modeledBodyBytes = nonFiniteHttpBodyBytes(response.body as BoundedNonFiniteErrorEnvelope)

      expect(modeledBodyBytes).toBeGreaterThanOrEqual(actualBodyBytes)
      expect(actualBodyBytes).toBeLessThanOrEqual(4_096)
    } finally {
      await app.close()
    }

    expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
  })

  it('同じ projection target と id の後続フィールドに上書きされる非有限 computed は保存を妨げない', async () => {
    const collisionTemplate: CharacterSheetTemplateEntity = {
      ...template,
      templateId: 'division-by-zero-id-collision-template',
      sections: [
        {
          ...template.sections[0],
          fields: [
            ...templateFields,
            {
              id: 'quotient',
              uid: 'uid-quotient-override',
              label: 'Finite quotient override',
              type: 'scalar',
              valueType: 'number'
            }
          ]
        }
      ]
    }
    const collisionCharacter: CharacterEntity = {
      ...character,
      sheet: {
        ...character.sheet!,
        templateId: collisionTemplate.templateId,
        values: {
          ...character.sheet!.values,
          'uid-quotient-override': 42
        }
      }
    }
    const savedCharacter: CharacterEntity = {
      ...collisionCharacter,
      sheet: {
        ...collisionCharacter.sheet!,
        revision: 2,
        values: {
          ...collisionCharacter.sheet!.values,
          'uid-denominator': 0
        }
      },
      computedCache: { 'uid-quotient': Number.POSITIVE_INFINITY }
    }
    const repository = {
      findById: jest.fn().mockResolvedValue(collisionCharacter),
      saveSheetMaterialized: jest.fn().mockResolvedValue(savedCharacter)
    }
    const operationService = createOperationService(repository, collisionTemplate)

    expect(validatePublishTemplate(collisionTemplate)).toEqual(expect.objectContaining({ ok: true, issues: [] }))
    await expect(operationService.saveSheet(saveInput)).resolves.toEqual(
      expect.objectContaining({ noOp: false, revision: 2 })
    )
    expect(repository.saveSheetMaterialized).toHaveBeenCalledTimes(1)
    expect(repository.saveSheetMaterialized.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        computedCache: { 'uid-quotient': Number.POSITIVE_INFINITY },
        parameter: expect.objectContaining({
          quotient: expect.objectContaining({ values: { base: 42 } })
        })
      })
    )
  })

  it('分母が 0 でない通常ケースは従来どおり保存する', async () => {
    const savedCharacter: CharacterEntity = {
      ...character,
      sheet: {
        ...character.sheet!,
        revision: 2,
        values: {
          'uid-numerator': 1,
          'uid-denominator': 2
        }
      },
      computedCache: { 'uid-quotient': 0.5 }
    }
    const repository = {
      findById: jest.fn().mockResolvedValue(character),
      saveSheetMaterialized: jest.fn().mockResolvedValue(savedCharacter)
    }
    const operationService = createOperationService(repository)

    await expect(
      operationService.saveSheet({
        characterId: character.characterId,
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-denominator' }, baseValue: 1, newValue: 2 }]
      })
    ).resolves.toEqual(expect.objectContaining({ noOp: false, revision: 2 }))
    expect(repository.saveSheetMaterialized).toHaveBeenCalledTimes(1)
    expect(repository.saveSheetMaterialized.mock.calls[0][1]).toEqual(
      expect.objectContaining({ computedCache: { 'uid-quotient': 0.5 } })
    )
  })

  it.each([
    {
      name: '0 / 0',
      numerator: 0,
      expectedResult: 'NaN' as const
    },
    {
      name: '-1 / 0',
      numerator: -1,
      expectedResult: '-Infinity' as const
    }
  ])('$name でも同じ経路で原因を含む 422 になり repository へ到達しない', async ({ numerator, expectedResult }) => {
    const repository = {
      findById: jest.fn().mockResolvedValue(character),
      saveSheetMaterialized: jest.fn()
    }
    const operationService = createOperationService(repository)

    await expectNonFiniteFailure(
      operationService,
      {
        characterId: character.characterId,
        baseRevision: 1,
        changes: [
          { path: { fieldUid: 'uid-numerator' }, baseValue: 1, newValue: numerator },
          { path: { fieldUid: 'uid-denominator' }, baseValue: 1, newValue: 0 }
        ]
      },
      expectedResult
    )
    expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
  })

  it('複数の computed フィールドが非有限なら message と issues に各原因を含める', () => {
    const multiFailureTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'parameter',
          label: 'Parameter',
          fields: [
            ...templateFields,
            {
              id: 'negative_quotient',
              uid: 'uid-negative-quotient',
              label: 'Negative quotient',
              type: 'computed',
              resultType: 'number',
              formula: '-{parameter.numerator} / {parameter.denominator}'
            }
          ]
        }
      ]
    }

    let failure: unknown
    try {
      new SheetMaterializerService().materialize({
        template: multiFailureTemplate,
        sheet: {
          templateId: multiFailureTemplate.templateId,
          templateVersion: multiFailureTemplate.version,
          revision: 1,
          values: {
            'uid-numerator': 1,
            'uid-denominator': 0
          }
        }
      })
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const response = (failure as UnprocessableEntityException).getResponse() as {
      message: string
      issues: Array<{ fieldUid?: string }>
    }
    expect(response.message).toContain('フィールド: uid-quotient')
    expect(response.message).toContain('結果: Infinity')
    expect(response.message).toContain('フィールド: uid-negative-quotient')
    expect(response.message).toContain('結果: -Infinity')
    expect(response.issues).toHaveLength(2)
    expect(response.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldUid: 'uid-quotient' }),
        expect.objectContaining({ fieldUid: 'uid-negative-quotient' })
      ])
    )
  })

  it('多数の非有限 computed と長い式でも診断レスポンスを一定サイズに制限する', () => {
    const computedFieldCount = 20
    const longFormula = `${formula} + 0.${'0'.repeat(850)}`
    const amplifiedTemplate: CharacterSheetTemplateEntity = {
      ...template,
      templateId: 'amplified-non-finite-diagnostics-template',
      sections: [
        {
          ...template.sections[0],
          fields: [
            ...templateFields.slice(0, 2),
            ...Array.from({ length: computedFieldCount }, (_, index) => ({
              id: `quotient_${index}`,
              uid: `uid-quotient-${index}`,
              label: `Quotient ${index}`,
              type: 'computed' as const,
              resultType: 'number' as const,
              formula: longFormula
            }))
          ]
        }
      ]
    }

    expect(validatePublishTemplate(amplifiedTemplate)).toEqual(expect.objectContaining({ ok: true, issues: [] }))

    let failure: unknown
    try {
      new SheetMaterializerService().materialize({
        template: amplifiedTemplate,
        sheet: {
          templateId: amplifiedTemplate.templateId,
          templateVersion: amplifiedTemplate.version,
          revision: 1,
          values: {
            'uid-numerator': 1,
            'uid-denominator': 0
          }
        }
      })
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const response = (failure as UnprocessableEntityException).getResponse() as {
      message: string
      issues: Array<{ fieldUid?: string; message: string }>
    }
    const responseBytes = Buffer.byteLength(JSON.stringify(response), 'utf8')
    const templateBytes = Buffer.byteLength(JSON.stringify(amplifiedTemplate), 'utf8')

    expect(response.message).toContain(`ほか ${computedFieldCount - 3} 件`)
    expect(response.message).toContain(`${longFormula.slice(0, 120)}…`)
    expect(response.message).not.toContain(longFormula)
    expect(response.issues).toHaveLength(3)
    expect(response.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldUid: 'uid-quotient-0' }),
        expect.objectContaining({ fieldUid: 'uid-quotient-1' }),
        expect.objectContaining({ fieldUid: 'uid-quotient-2' })
      ])
    )
    expect(responseBytes).toBeLessThanOrEqual(4_096)
    expect(responseBytes).toBeLessThan(templateBytes)
  })

  it.each([
    { dimension: 'label' as const, previousResponseSize: '601KB', expectedIssueCount: 3 },
    { dimension: 'uid' as const, previousResponseSize: '1.2MB', expectedIssueCount: 0 }
  ])(
    '長大 $dimension 100,000文字×20件でも修正前の $previousResponseSize 応答には戻らず実 HTTP body を4,096 bytes以下に抑える',
    async ({ dimension, expectedIssueCount }) => {
      const computedFieldCount = 20
      const longLabel = 'L'.repeat(100_000)
      const longUid = (index: number) => `${String(index).padStart(2, '0')}${'u'.repeat(99_998)}`
      const amplifiedTemplate: CharacterSheetTemplateEntity = {
        ...template,
        templateId: `http-amplified-${dimension}-template`,
        sections: [
          {
            ...template.sections[0],
            fields: [
              ...templateFields.slice(0, 2),
              ...Array.from({ length: computedFieldCount }, (_, index) => ({
                id: `quotient_${index}`,
                uid: dimension === 'uid' ? longUid(index) : `uid-quotient-${index}`,
                label: dimension === 'label' ? longLabel : `Quotient ${index}`,
                type: 'computed' as const,
                resultType: 'number' as const,
                formula
              }))
            ]
          }
        ]
      }
      const amplifiedCharacter: CharacterEntity = {
        ...character,
        sheet: {
          ...character.sheet!,
          templateId: amplifiedTemplate.templateId,
          values: {
            'uid-numerator': 1,
            'uid-denominator': 1
          }
        }
      }
      const repository = {
        findById: jest.fn().mockResolvedValue(amplifiedCharacter),
        saveSheetMaterialized: jest.fn()
      }
      const operationService = createOperationService(repository, amplifiedTemplate)

      expect(validatePublishTemplate(amplifiedTemplate)).toEqual(expect.objectContaining({ ok: true, issues: [] }))

      const app = await createHttpApp(operationService, amplifiedCharacter)
      try {
        const response = await request(app.getHttpServer())
          .put(`/character/${amplifiedCharacter.characterId}/sheet`)
          .send({ baseRevision: 1, changes: saveInput.changes })
          .expect(422)

        expect(Buffer.byteLength(response.text, 'utf8')).toBeLessThanOrEqual(4_096)
        expect(response.body.message).toContain(`ほか ${computedFieldCount - 3} 件`)
        expect(response.body.issues).toHaveLength(expectedIssueCount)
      } finally {
        await app.close()
      }

      expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    }
  )

  it('長大 uid の issue は fieldUid と path を切り詰めず、実 HTTP body を4,096 bytes以下に保つ', async () => {
    const longUid = `uid-${'u'.repeat(508)}`
    const longUidTemplate: CharacterSheetTemplateEntity = {
      ...template,
      templateId: 'long-uid-preservation-template',
      sections: [
        {
          ...template.sections[0],
          fields: [
            ...templateFields.slice(0, 2),
            {
              id: 'long_uid_quotient',
              uid: longUid,
              label: 'Long UID quotient',
              type: 'computed',
              resultType: 'number',
              formula
            }
          ]
        }
      ]
    }
    const longUidCharacter: CharacterEntity = {
      ...character,
      sheet: {
        ...character.sheet!,
        templateId: longUidTemplate.templateId
      }
    }
    const repository = {
      findById: jest.fn().mockResolvedValue(longUidCharacter),
      saveSheetMaterialized: jest.fn()
    }
    const operationService = createOperationService(repository, longUidTemplate)

    expect(validatePublishTemplate(longUidTemplate)).toEqual(expect.objectContaining({ ok: true, issues: [] }))

    const app = await createHttpApp(operationService, longUidCharacter)
    try {
      const response = await request(app.getHttpServer())
        .put(`/character/${longUidCharacter.characterId}/sheet`)
        .send({ baseRevision: 1, changes: saveInput.changes })
        .expect(422)

      expect(Buffer.byteLength(response.text, 'utf8')).toBeLessThanOrEqual(4_096)
      expect(response.body.issues).toEqual([
        expect.objectContaining({
          fieldUid: longUid,
          path: [longUid]
        })
      ])
      expect(response.body.issues[0].fieldUid).not.toContain('…')
      expect(response.body.issues[0].path[0]).not.toContain('…')
    } finally {
      await app.close()
    }

    expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
  })

  it('100,000文字 track UID の max 評価失敗でも production HTTP 封筒を4,096 bytes以下に保つ', async () => {
    const longTrackUid = 't'.repeat(100_000)
    const trackMaxTemplate: CharacterSheetTemplateEntity = {
      ...template,
      templateId: 'long-track-max-template',
      sections: [
        {
          ...template.sections[0],
          fields: [
            ...templateFields.slice(0, 2),
            {
              id: 'hp',
              uid: longTrackUid,
              label: 'HP',
              type: 'track',
              min: 0,
              max: { formula },
              style: 'gauge'
            }
          ]
        }
      ]
    }
    const trackMaxCharacter: CharacterEntity = {
      ...character,
      sheet: {
        ...character.sheet!,
        templateId: trackMaxTemplate.templateId,
        values: {
          'uid-numerator': 1,
          'uid-denominator': 0,
          [longTrackUid]: 1
        }
      },
      computedCache: {}
    }
    const repository = {
      findById: jest.fn().mockResolvedValue(trackMaxCharacter),
      saveSheetMaterialized: jest.fn()
    }
    const operationService = createOperationService(repository, trackMaxTemplate)
    const app = await createHttpApp(operationService, trackMaxCharacter)

    try {
      const response = await request(app.getHttpServer())
        .put(`/character/${trackMaxCharacter.characterId}/sheet`)
        .send({
          baseRevision: 1,
          changes: [{ path: { fieldUid: longTrackUid }, baseValue: 1, newValue: 2 }]
        })

      expect({
        status: response.status,
        bodyBytesWithinBudget: Buffer.byteLength(response.text, 'utf8') <= 4_096,
        hasTrackMaxCause: response.body.message.includes('トラック最大値の計算に失敗しました'),
        issues: response.body.issues,
        repositorySaveCalls: repository.saveSheetMaterialized.mock.calls.length
      }).toEqual({
        status: 422,
        bodyBytesWithinBudget: true,
        hasTrackMaxCause: true,
        issues: [],
        repositorySaveCalls: 0
      })
    } finally {
      await app.close()
    }
  })

  it('長大な既存 issue と非有限 roll の同時発生でも production HTTP 封筒を4,096 bytes以下に保つ', async () => {
    const unknownUid = 'u'.repeat(100_000)
    const mixedIssueTemplate: CharacterSheetTemplateEntity = {
      ...template,
      templateId: 'long-existing-issue-and-roll-template',
      sections: [
        {
          ...template.sections[0],
          fields: [
            {
              id: 'score',
              uid: 'uid-score',
              label: 'Score',
              type: 'scalar',
              valueType: 'number'
            },
            {
              id: 'roll',
              uid: 'uid-roll',
              label: 'Roll',
              type: 'roll',
              notation: '1d100'
            }
          ]
        }
      ]
    }
    const mixedIssueCharacter: CharacterEntity = {
      ...character,
      sheet: {
        ...character.sheet!,
        templateId: mixedIssueTemplate.templateId,
        values: {
          'uid-score': 1,
          [unknownUid]: 1,
          'uid-roll': Number.POSITIVE_INFINITY
        }
      },
      computedCache: {}
    }
    const repository = {
      findById: jest.fn().mockResolvedValue(mixedIssueCharacter),
      saveSheetMaterialized: jest.fn()
    }
    const operationService = createOperationService(repository, mixedIssueTemplate)
    const app = await createHttpApp(operationService, mixedIssueCharacter)

    try {
      const response = await request(app.getHttpServer())
        .put(`/character/${mixedIssueCharacter.characterId}/sheet`)
        .send({
          baseRevision: 1,
          changes: [{ path: { fieldUid: 'uid-score' }, baseValue: 1, newValue: 2 }]
        })

      expect({
        status: response.status,
        bodyBytesWithinBudget: Buffer.byteLength(response.text, 'utf8') <= 4_096,
        hasUnknownFieldCause: response.body.message.includes('テンプレート未定義フィールド'),
        hasNonFiniteRollCause: response.body.message.includes('ロール結果が有限な数値になりませんでした'),
        issues: response.body.issues,
        repositorySaveCalls: repository.saveSheetMaterialized.mock.calls.length
      }).toEqual({
        status: 422,
        bodyBytesWithinBudget: true,
        hasUnknownFieldCause: true,
        hasNonFiniteRollCause: true,
        issues: [
          expect.objectContaining({
            fieldUid: 'uid-roll',
            path: ['uid-roll'],
            message: expect.stringContaining('ロール結果が有限な数値になりませんでした')
          })
        ],
        repositorySaveCalls: 0
      })
    } finally {
      await app.close()
    }
  })

  it('stored parts 合計 overflow から有限値 5 への修復更新を production HTTP 経路で保存する', async () => {
    const overflowValue = {
      parts: { first: Number.MAX_VALUE, second: Number.MAX_VALUE }
    }
    const trackTemplate: CharacterSheetTemplateEntity = {
      ...template,
      templateId: 'track-overflow-repair-template',
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
              style: 'gauge'
            }
          ]
        }
      ]
    }
    const overflowCharacter: CharacterEntity = {
      ...character,
      sheet: {
        ...character.sheet!,
        templateId: trackTemplate.templateId,
        values: { 'uid-hp': overflowValue }
      },
      computedCache: {}
    }
    const savedCharacter: CharacterEntity = {
      ...overflowCharacter,
      sheet: {
        ...overflowCharacter.sheet!,
        revision: 2,
        values: { 'uid-hp': 5 }
      }
    }
    const repository = {
      findById: jest.fn().mockResolvedValue(overflowCharacter),
      saveSheetMaterialized: jest.fn().mockResolvedValue(savedCharacter)
    }
    const operationService = createOperationService(repository, trackTemplate)
    const app = await createHttpApp(operationService, overflowCharacter)

    try {
      const response = await request(app.getHttpServer())
        .put(`/character/${overflowCharacter.characterId}/sheet`)
        .send({
          baseRevision: 1,
          changes: [{ path: { fieldUid: 'uid-hp' }, baseValue: overflowValue, newValue: 5 }]
        })

      expect({
        status: response.status,
        revision: response.body.revision,
        noOp: response.body.noOp,
        repositorySaveCalls: repository.saveSheetMaterialized.mock.calls.length
      }).toEqual({
        status: 200,
        revision: 2,
        noOp: false,
        repositorySaveCalls: 1
      })
    } finally {
      await app.close()
    }
  })

  it('stored 有限値 5 から parts 合計 overflow への更新は production HTTP 経路で拒否する', async () => {
    const overflowValue = {
      parts: { first: Number.MAX_VALUE, second: Number.MAX_VALUE }
    }
    const trackTemplate: CharacterSheetTemplateEntity = {
      ...template,
      templateId: 'track-overflow-rejection-template',
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
              style: 'gauge'
            }
          ]
        }
      ]
    }
    const finiteCharacter: CharacterEntity = {
      ...character,
      sheet: {
        ...character.sheet!,
        templateId: trackTemplate.templateId,
        values: { 'uid-hp': 5 }
      },
      computedCache: {}
    }
    const repository = {
      findById: jest.fn().mockResolvedValue(finiteCharacter),
      saveSheetMaterialized: jest.fn()
    }
    const operationService = createOperationService(repository, trackTemplate)
    const app = await createHttpApp(operationService, finiteCharacter)

    try {
      const response = await request(app.getHttpServer())
        .put(`/character/${finiteCharacter.characterId}/sheet`)
        .send({
          baseRevision: 1,
          changes: [{ path: { fieldUid: 'uid-hp' }, baseValue: 5, newValue: overflowValue }]
        })

      expect({
        status: response.status,
        hasTrackInputCause: response.body.message.includes('トラックの入力値が有限な数値になりませんでした'),
        repositorySaveCalls: repository.saveSheetMaterialized.mock.calls.length
      }).toEqual({
        status: 422,
        hasTrackInputCause: true,
        repositorySaveCalls: 0
      })
    } finally {
      await app.close()
    }
  })
})
