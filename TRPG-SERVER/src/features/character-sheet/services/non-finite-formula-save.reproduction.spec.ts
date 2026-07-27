import { ExecutionContext, INestApplication, UnprocessableEntityException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { validatePublishTemplate } from '@trpg/sheet-engine'
import type { SheetField } from '@trpg/sheet-engine'
import { Request } from 'express'
import request from 'supertest'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import type { CharacterEntity } from '../../../domains/character/models/character.entity'
import { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import { JwtAuthGuard } from '../../../domains/auth/guards/jwt-auth.guard'
import {
  CHARACTER_INSTANTIATION_USE_CASE,
  CHARACTER_SHEET_OPERATION_USE_CASE,
  CharacterSheetController
} from '../../../domains/character/character.controller'
import { CharacterService } from '../../../domains/character/character.service'
import { CharacterSheetOperationService, SaveSheetInput } from './character-sheet-operation.service'
import { SheetMaterializerService } from './sheet-materializer.service'

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
        { provide: CHARACTER_INSTANTIATION_USE_CASE, useValue: { instantiate: jest.fn() } }
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
      // NOTE: 現在はグローバル APP_FILTER がなく、Nest 標準の例外 body がそのまま返る前提。追加時は本番 body と再照合する。
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
})
