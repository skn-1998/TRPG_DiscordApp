import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  INestApplication,
  Logger,
  UnprocessableEntityException
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import type { Request } from 'express'
import request from 'supertest'
import { AppConfigService } from '../../config/config.service'
import {
  APP_GLOBAL_EXCEPTION_FILTER_PROVIDER,
  GLOBAL_INTERNAL_ERROR_MESSAGE
} from '../../core/http/global-exception.filter'
import { APP_VALIDATION_PIPE_PROVIDER } from '../../core/http/validation-pipe.provider'
import { JwtAuthGuard } from '../../domains/auth/guards/jwt-auth.guard'
import {
  CHARACTER_INSTANTIATION_USE_CASE,
  CHARACTER_SHEET_OPERATION_USE_CASE,
  CharacterSheetController
} from './character-sheet.controller'
import { CharacterService } from '../../domains/character/character.service'
import {
  buildBoundedNonFiniteErrorEnvelope,
  buildSheetErrorEnvelope,
  nonFiniteHttpBodyBytes
} from './services/track-range.policy'

describe('CharacterSheetHttpExceptionFilter', () => {
  const characterId = 'character-filter-test'
  const validSaveBody = {
    baseRevision: 1,
    changes: [{ path: { fieldUid: 'uid-hp' }, baseValue: 10, newValue: 9 }]
  }
  const characterService = {
    findOneForOwner: jest.fn()
  }
  const saveSheet = jest.fn()
  const instantiate = jest.fn()
  let attachAuthenticatedUser = true
  let app: INestApplication

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterSheetController],
      providers: [
        { provide: CharacterService, useValue: characterService },
        { provide: CHARACTER_SHEET_OPERATION_USE_CASE, useValue: { saveSheet } },
        { provide: CHARACTER_INSTANTIATION_USE_CASE, useValue: { instantiate } },
        { provide: AppConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
        APP_VALIDATION_PIPE_PROVIDER,
        APP_GLOBAL_EXCEPTION_FILTER_PROVIDER
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<Request>()
          if (attachAuthenticatedUser) {
            req.user = { username: 'Alice', discordUserId: 'owner-1' }
          }
          return true
        }
      })
      .compile()

    app = module.createNestApplication()
    await app.init()
  })

  beforeEach(() => {
    attachAuthenticatedUser = true
    characterService.findOneForOwner.mockReset()
    characterService.findOneForOwner.mockResolvedValue({ characterId })
    saveSheet.mockReset()
    saveSheet.mockResolvedValue({ revision: 2, noOp: false })
    instantiate.mockReset()
  })

  afterAll(async () => {
    await app.close()
  })

  const putSheet = () => request(app.getHttpServer()).put(`/character/${characterId}/sheet`).send(validSaveBody)
  const postFromTemplate = () =>
    request(app.getHttpServer()).post('/character/from-template').send({
      templateId: 'template-1',
      templateVersion: '1.0.0',
      characterName: 'Alice'
    })

  const expectEnvelope = (
    body: Record<string, unknown>,
    expected: {
      error: string
      issues?: unknown
      cause?: unknown
    }
  ): void => {
    const expectedKeys = ['error', 'message', 'requestId', 'success', 'timestamp']
    if (expected.issues !== undefined) expectedKeys.push('issues')
    if (expected.cause !== undefined) expectedKeys.push('cause')

    expect(Object.keys(body).sort()).toEqual(expectedKeys.sort())
    expect(body).toEqual({
      success: false,
      message: 'エラーが発生しました',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: expected.error,
      ...(expected.issues === undefined ? {} : { issues: expected.issues }),
      ...(expected.cause === undefined ? {} : { cause: expected.cause })
    })
    expect(body).not.toHaveProperty('stack')
  }

  it.each([
    {
      name: '422 out-of-bounds',
      exception: () =>
        new UnprocessableEntityException({
          message: 'track field uid-hp value is outside resolved bounds',
          fieldUid: 'uid-hp',
          value: 11,
          min: 0,
          max: 10
        }),
      status: 422,
      error: 'track field uid-hp value is outside resolved bounds',
      cause: { fieldUid: 'uid-hp', value: 11, min: 0, max: 10 }
    },
    {
      name: '422 detail',
      exception: () =>
        new UnprocessableEntityException({
          message: 'sheet evaluation failed',
          detail: 'Unknown field reference: uid-missing'
        }),
      status: 422,
      error: 'sheet evaluation failed',
      cause: { detail: 'Unknown field reference: uid-missing' }
    },
    {
      name: '409 conflicts',
      exception: () =>
        new ConflictException({
          message: 'sheet changes conflict with the current revision',
          characterId,
          currentRevision: 2,
          conflicts: [
            {
              path: { fieldUid: 'uid-hp' },
              current: 8,
              base: 10,
              yours: 9
            }
          ]
        }),
      status: 409,
      error: 'sheet changes conflict with the current revision',
      cause: {
        characterId,
        currentRevision: 2,
        conflicts: [
          {
            path: { fieldUid: 'uid-hp' },
            current: 8,
            base: 10,
            yours: 9
          }
        ]
      }
    },
    {
      name: '409 refetchRequired',
      exception: () =>
        new ConflictException({
          message: 'sheet changed repeatedly; refetch the latest revision and retry',
          characterId,
          refetchRequired: true
        }),
      status: 409,
      error: 'sheet changed repeatedly; refetch the latest revision and retry',
      cause: { characterId, refetchRequired: true }
    }
  ])('$name の情報と status を封筒へ保つ', async ({ exception, status, error, cause }) => {
    saveSheet.mockRejectedValueOnce(exception())

    const response = await putSheet().expect(status)

    expectEnvelope(response.body, { error, cause })
  })

  it('非有限 422 は builder の診断 message と issues をそのまま最終 wire 封筒へ保つ', async () => {
    const exceptionBody = buildBoundedNonFiniteErrorEnvelope([
      {
        kind: 'computed',
        fieldUid: 'uid-quotient',
        label: 'Quotient',
        formula: '1 / 0',
        result: 'Infinity'
      }
    ])
    saveSheet.mockRejectedValueOnce(new UnprocessableEntityException(exceptionBody))

    const response = await putSheet().expect(422)
    const expectedEnvelope = buildSheetErrorEnvelope(
      exceptionBody.message,
      { issues: exceptionBody.issues },
      {
        timestamp: response.body.timestamp,
        requestId: response.body.requestId
      }
    )

    expect(nonFiniteHttpBodyBytes(exceptionBody)).toBe(678)
    expect(Buffer.byteLength(response.text, 'utf8')).toBe(678)
    expect(response.text).toBe(JSON.stringify(expectedEnvelope))
    expect(response.body).toStrictEqual(expectedEnvelope)
    expect(Object.keys(response.body).sort()).toEqual([
      'error',
      'issues',
      'message',
      'requestId',
      'success',
      'timestamp'
    ])
    expect(response.body).toMatchObject({
      success: false,
      message: 'エラーが発生しました',
      error: exceptionBody.message,
      issues: exceptionBody.issues
    })
  })

  it('ValidationPipe 400 は message 配列を順序どおり結合し、元配列も cause.message に残す', async () => {
    const response = await request(app.getHttpServer())
      .put(`/character/${characterId}/sheet`)
      .send({ baseRevision: 'invalid', changes: 'invalid' })
      .expect(400)

    const messages = response.body.cause.message as string[]
    expect(messages).toEqual(
      expect.arrayContaining(['baseRevision must not be less than 0', 'baseRevision must be an integer number'])
    )
    expect(messages).toContain('changes must be an array')
    expect(response.body.error).toBe(messages.join('; '))
    expectEnvelope(response.body, {
      error: messages.join('; '),
      cause: { message: messages }
    })
    expect(saveSheet).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: '403 sheet template owner mismatch',
      exception: () => new ForbiddenException('sheet template owner mismatch'),
      arrange: (exception: HttpException) => instantiate.mockRejectedValueOnce(exception),
      request: () => postFromTemplate(),
      status: 403,
      error: 'sheet template owner mismatch'
    },
    {
      name: '409 template version mismatch',
      exception: () => new ConflictException('sheet template must be published at the requested version'),
      arrange: (exception: HttpException) => instantiate.mockRejectedValueOnce(exception),
      request: () => postFromTemplate(),
      status: 409,
      error: 'sheet template must be published at the requested version'
    },
    {
      name: '409 character is not materialized',
      exception: () => new ConflictException('character is not materialized'),
      arrange: (exception: HttpException) => saveSheet.mockRejectedValueOnce(exception),
      request: () => putSheet(),
      status: 409,
      error: 'character is not materialized'
    }
  ])('$name は既知キー集合と status を維持し、冗長キーを cause に載せない', async (testCase) => {
    const exception = testCase.exception()
    expect(Object.keys(exception.getResponse()).sort()).toEqual(['error', 'message', 'statusCode'])
    testCase.arrange(exception)

    const response = await testCase.request().expect(testCase.status)

    expectEnvelope(response.body, { error: testCase.error })
  })

  it('人工 HttpException body の未知 own key は同名・値不変で cause に残し、inherited key は除外する', async () => {
    const exceptionBody = Object.assign(
      Object.create({ inheritedDiagnostic: 'must not cross the HTTP boundary' }) as Record<string, unknown>,
      {
        statusCode: 429,
        message: 'sheet retry is required',
        error: 'Too Many Requests',
        retryAfterMs: 1250,
        futureDiagnostic: {
          code: 'future-shape',
          path: ['sheet', 'values']
        }
      }
    )
    saveSheet.mockRejectedValueOnce(new HttpException(exceptionBody, 429))

    const response = await putSheet().expect(429)

    expectEnvelope(response.body, {
      error: 'sheet retry is required',
      cause: {
        retryAfterMs: 1250,
        futureDiagnostic: {
          code: 'future-shape',
          path: ['sheet', 'values']
        }
      }
    })
    expect(response.body.cause).not.toHaveProperty('inheritedDiagnostic')
  })

  it('401 は message だけを error に写し、構造キャリアを追加しない', async () => {
    attachAuthenticatedUser = false

    const response = await putSheet().expect(401)

    expectEnvelope(response.body, { error: '認証トークンがありません' })
    expect(characterService.findOneForOwner).not.toHaveBeenCalled()
  })

  it('404 は message だけを error に写し、status を変えない', async () => {
    characterService.findOneForOwner.mockResolvedValueOnce(null)

    const response = await putSheet().expect(404)

    expectEnvelope(response.body, { error: 'character not found' })
    expect(saveSheet).not.toHaveBeenCalled()
  })

  it('string body の HttpException は文字列を error に保つ', async () => {
    saveSheet.mockRejectedValueOnce(new HttpException('plain sheet failure', 422))

    const response = await putSheet().expect(422)

    expectEnvelope(response.body, { error: 'plain sheet failure' })
  })

  it('HttpException body の読み取りが失敗しても二次例外を投げず、同じ status の fail-safe 封筒を返す', async () => {
    const exception = new UnprocessableEntityException('safe fallback message')
    Object.defineProperty(exception, 'response', {
      configurable: true,
      get: () => {
        throw new Error('hostile-response-accessor')
      }
    })
    saveSheet.mockRejectedValueOnce(exception)

    const response = await putSheet().expect(422)

    expectEnvelope(response.body, { error: 'safe fallback message' })
    expect(JSON.stringify(response.body)).not.toContain('hostile-response-accessor')
  })

  it('非 HttpException は sheet filter が飲み込まず、GlobalExceptionFilter の固定 500 封筒へ渡す', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    saveSheet.mockRejectedValueOnce(new Error('raw-sheet-internal-detail'))

    try {
      const response = await putSheet().expect(500)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          message: 'エラーが発生しました',
          error: GLOBAL_INTERNAL_ERROR_MESSAGE,
          timestamp: expect.any(Number),
          requestId: expect.any(String)
        })
      )
      expect(response.body).not.toHaveProperty('stack')
      expect(JSON.stringify(response.body)).not.toContain('raw-sheet-internal-detail')
    } finally {
      errorSpy.mockRestore()
    }
  })
})
