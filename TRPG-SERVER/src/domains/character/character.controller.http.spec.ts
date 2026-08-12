import { ExecutionContext, INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Request } from 'express'
import { Types } from 'mongoose'
import request from 'supertest'
import {
  characterSummaryRuntimeKeys,
  expectAllRequiredCharacterRuntimeKeys,
  expectCharacterEntitySchemaWireData,
  expectIsoDateString,
  expectOnlyCharacterRuntimeKeys,
  expectOnlyCharacterSummaryRuntimeKeys,
  expectSuccessEnvelope,
  JsonObject
} from 'test/utils/character-http-contract'
import { AppConfigService } from '../../config/config.service'
import { ResponseInterceptor } from '../../core/http'
import {
  APP_GLOBAL_EXCEPTION_FILTER_PROVIDER,
  GLOBAL_INTERNAL_ERROR_MESSAGE
} from '../../core/http/global-exception.filter'
import { APP_VALIDATION_PIPE_PROVIDER } from '../../core/http/validation-pipe.provider'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'

/**
 * CharacterController の実 HTTP 応答契約を検証する。
 * service 境界だけをモックし、guard override、実 interceptor、実 global filter を通す。
 */
describe('CharacterController HTTP payload contract', () => {
  const authenticatedUser = {
    username: 'character-http-user',
    discordUserId: 'character-http-user-id'
  }
  const characterService = {
    create: jest.fn(),
    findHavingAll: jest.fn(),
    findOneForOwner: jest.fn(),
    findUserCharacterSummaries: jest.fn(),
    updateForOwner: jest.fn(),
    removeForOwner: jest.fn()
  }

  let app: INestApplication

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterController],
      providers: [
        { provide: CharacterService, useValue: characterService },
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn(() => 'test')
          }
        },
        ResponseInterceptor,
        APP_VALIDATION_PIPE_PROVIDER,
        APP_GLOBAL_EXCEPTION_FILTER_PROVIDER
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<Request>()
          req.user = authenticatedUser
          return true
        }
      })
      .compile()

    app = module.createNestApplication()
    await app.init()
  })

  beforeEach(() => {
    characterService.create.mockReset()
    characterService.findHavingAll.mockReset()
    characterService.findOneForOwner.mockReset()
    characterService.findUserCharacterSummaries.mockReset()
    characterService.updateForOwner.mockReset()
    characterService.removeForOwner.mockReset()
  })

  afterAll(async () => {
    await app.close()
  })

  const createCharacterFixture = (overrides: JsonObject = {}): JsonObject => ({
    _id: new Types.ObjectId('507f1f77bcf86cd799439020'),
    __v: 1,
    characterId: 'character-http-fixture',
    characterName: 'HTTP Fixture Character',
    gameSystemId: 'coc7',
    discordUserId: authenticatedUser.discordUserId,
    discordChannelId: 'http-fixture-channel',
    status: {
      HP: { name: 'HP', index: 1, values: { base: 12, other: -2 }, isVisible: true }
    },
    createdAt: new Date('2026-07-10T01:02:03.004Z'),
    updatedAt: new Date('2026-07-11T02:03:04.005Z'),
    ...overrides
  })

  const expectEntityWireData = (data: JsonObject): void => {
    expectOnlyCharacterRuntimeKeys(data)
    expectAllRequiredCharacterRuntimeKeys(data)
    expectIsoDateString(data.createdAt)
    expectIsoDateString(data.updatedAt)
    expectCharacterEntitySchemaWireData(data)
  }

  it('POST /character は 201・meta なしの封筒で作成済み entity wire を返す', async () => {
    const createdCharacter = createCharacterFixture({
      characterId: 'character-http-created',
      characterName: 'HTTP Created Character'
    })
    characterService.create.mockResolvedValueOnce(createdCharacter)

    const response = await request(app.getHttpServer())
      .post('/character')
      .send({
        characterId: 'character-http-created',
        characterName: 'HTTP Created Character',
        gameSystemId: 'coc7',
        discordChannelId: 'http-fixture-channel',
        status: createdCharacter.status
      })
      .expect(201)
    const body = response.body as JsonObject
    const data = body.data as JsonObject

    expectSuccessEnvelope(body, 'キャラクターを作成しました')
    expect(body).not.toHaveProperty('meta')
    expectEntityWireData(data)
    expect(characterService.create).toHaveBeenCalledWith({
      characterId: 'character-http-created',
      characterName: 'HTTP Created Character',
      gameSystemId: 'coc7',
      discordChannelId: 'http-fixture-channel',
      status: createdCharacter.status,
      discordUserId: authenticatedUser.discordUserId
    })
  })

  it('POST /character は ValidationPipe で文字列でない characterId を 400 にする', async () => {
    const response = await request(app.getHttpServer())
      .post('/character')
      .send({
        characterId: 999,
        characterName: 'N',
        gameSystemId: 'coc7'
      })
      .expect(400)

    expect(response.body.error).toBe('キャラクターIDは文字列である必要があります')
    expect(characterService.create).not.toHaveBeenCalled()
  })

  it('GET /character/:id の素の Error は global の固定 500 封筒になる', async () => {
    const rawMessage = 'character-service-private-detail'
    characterService.findOneForOwner.mockRejectedValueOnce(new Error(rawMessage))

    const response = await request(app.getHttpServer()).get('/character/raw-error-character').expect(500)

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: GLOBAL_INTERNAL_ERROR_MESSAGE,
        requestId: expect.any(String)
      })
    )
    expect(JSON.stringify(response.body)).not.toContain(rawMessage)
    expect(characterService.findOneForOwner).toHaveBeenCalledWith(
      'raw-error-character',
      authenticatedUser.discordUserId
    )
  })

  it('GET /character は二重ラップせず entity wire 配列と実件数に一致する meta を返す', async () => {
    const characters = [
      createCharacterFixture({
        _id: new Types.ObjectId('507f1f77bcf86cd799439021'),
        characterId: 'character-http-list-1'
      }),
      createCharacterFixture({
        _id: new Types.ObjectId('507f1f77bcf86cd799439022'),
        characterId: 'character-http-list-2'
      })
    ]
    characterService.findHavingAll.mockResolvedValueOnce(characters)

    const response = await request(app.getHttpServer()).get('/character').expect(200)
    const body = response.body as JsonObject
    const data = body.data as JsonObject[]

    expectSuccessEnvelope(body, 'キャラクター一覧を取得しました', ['meta'])
    expect(body.meta).toEqual({
      total: characters.length,
      page: 1,
      limit: characters.length,
      hasNext: false,
      hasPrev: false
    })
    expect(Array.isArray(data)).toBe(true)
    expect((body.data as { data?: unknown }).data).toBeUndefined()
    expect(data).toHaveLength(characters.length)
    for (const character of data) {
      expectEntityWireData(character)
    }
    expect(characterService.findHavingAll).toHaveBeenCalledWith(authenticatedUser.discordUserId)
  })

  it('PUT /character/:id は 200・meta なしの封筒で更新済み entity wire を返す', async () => {
    const updatedCharacter = createCharacterFixture({
      characterId: 'character-http-updated',
      characterName: 'HTTP Updated Character',
      updatedAt: new Date('2026-07-12T03:04:05.006Z')
    })
    characterService.updateForOwner.mockResolvedValueOnce(updatedCharacter)

    const response = await request(app.getHttpServer())
      .put('/character/character-http-updated')
      .send({ characterName: 'HTTP Updated Character' })
      .expect(200)
    const body = response.body as JsonObject
    const data = body.data as JsonObject

    expectSuccessEnvelope(body, 'キャラクターを更新しました')
    expect(body).not.toHaveProperty('meta')
    expectEntityWireData(data)
    expect(characterService.updateForOwner).toHaveBeenCalledWith(
      'character-http-updated',
      authenticatedUser.discordUserId,
      { characterName: 'HTTP Updated Character' }
    )
  })

  it('DELETE /character/:id は 200・meta なしで封筒 message と削除結果 message を別フィールドに保持する', async () => {
    const characterId = 'character-http-deleted'
    characterService.removeForOwner.mockResolvedValueOnce({ characterId })

    const response = await request(app.getHttpServer()).delete(`/character/${characterId}`).expect(200)
    const body = response.body as JsonObject
    const data = body.data as JsonObject
    const expectedDeleteResult = {
      message: 'キャラクターを削除しました',
      characterId
    }

    expectSuccessEnvelope(body, 'キャラクターを削除しました')
    expect(body).not.toHaveProperty('meta')
    expect(Object.keys(data).sort()).toEqual(Object.keys(expectedDeleteResult).sort())
    expect(body.message).toBe('キャラクターを削除しました')
    expect(data.message).toBe('キャラクターを削除しました')
    expect(data.characterId).toBe(characterId)
    expect(characterService.removeForOwner).toHaveBeenCalledWith(characterId, authenticatedUser.discordUserId)
  })

  it('GET /character/:id は完全な実 payload を wire 許可キーと ISO 日時で返す', async () => {
    const createdAt = new Date('2026-07-01T01:02:03.004Z')
    const updatedAt = new Date('2026-07-02T02:03:04.005Z')
    const retryAt = new Date('2026-07-03T03:04:05.006Z')
    characterService.findOneForOwner.mockResolvedValueOnce({
      _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      __v: 7,
      characterId: 'character-http-complete',
      characterName: 'HTTP Complete Character',
      gameSystemId: 'coc7',
      discordUserId: authenticatedUser.discordUserId,
      discordChannelId: 'discord-channel-id',
      discordThreadId: 'discord-thread-id',
      status: {
        HP: { name: 'HP', index: 1, values: { base: 12, other: -2 }, isVisible: true }
      },
      skill: {
        SpotHidden: { name: '目星', values: { base: 25 }, dice: '1d100' }
      },
      parameter: {
        STR: { name: 'STR', values: { base: 60 } }
      },
      item: {
        Rope: { name: 'ロープ', description: '10m' }
      },
      description: {
        Memo: { name: 'メモ', description: 'runtime payload fixture' }
      },
      sheet: {
        templateId: 'template-id',
        templateVersion: '1.0.0',
        revision: 3,
        visibility: 'private',
        values: { hp: 10, note: 'ready' }
      },
      templatePin: {
        templateId: 'template-id',
        templateVersion: '1.0.0',
        pinnedBy: authenticatedUser.discordUserId
      },
      computedCache: {
        hp: 10,
        label: 'healthy',
        visible: true
      },
      palette: [
        {
          key: 'spot-hidden',
          fieldRef: { uid: 'skill-spot-hidden' },
          label: '目星',
          kind: 'roll',
          notation: '1d100',
          group: 'skills'
        },
        {
          key: 'hp-delta',
          fieldRef: { uid: 'status-hp', rowId: 'main' },
          label: 'HP',
          kind: 'resource',
          deltas: [-1, 1],
          group: 'resources'
        }
      ],
      hub: {
        status: 'active',
        opId: 'hub-operation-id',
        messageId: 'hub-message-id',
        threadId: 'hub-thread-id',
        pendingRevision: 4,
        appliedRevision: 3,
        retryAt,
        errorCode: 'RETRY_PENDING'
      },
      appliedInteractionIds: ['interaction-1'],
      createdAt,
      updatedAt
    })

    const response = await request(app.getHttpServer()).get('/character/character-http-complete').expect(200)
    const body = response.body as JsonObject
    const data = body.data as JsonObject

    expectSuccessEnvelope(body, 'キャラクターを取得しました')
    expectOnlyCharacterRuntimeKeys(data)
    expectAllRequiredCharacterRuntimeKeys(data)
    expect(data._id).toBe('507f1f77bcf86cd799439011')
    expect(data.__v).toBe(7)
    expectIsoDateString(data.createdAt)
    expectIsoDateString(data.updatedAt)
    expectIsoDateString((data.hub as JsonObject).retryAt)
    expectCharacterEntitySchemaWireData(data)
    expect(characterService.findOneForOwner).toHaveBeenCalledWith(
      'character-http-complete',
      authenticatedUser.discordUserId
    )
  })

  it('GET /character/:id は section default がない legacy 行を欠損キーのまま返す', async () => {
    characterService.findOneForOwner.mockResolvedValueOnce({
      _id: '507f1f77bcf86cd799439012',
      __v: 0,
      characterId: 'character-http-legacy',
      characterName: 'HTTP Legacy Character',
      gameSystemId: 'coc6',
      discordUserId: authenticatedUser.discordUserId,
      discordChannelId: 'legacy-channel-id'
    })

    const response = await request(app.getHttpServer()).get('/character/character-http-legacy').expect(200)
    const body = response.body as JsonObject
    const data = body.data as JsonObject

    expectSuccessEnvelope(body, 'キャラクターを取得しました')
    expectOnlyCharacterRuntimeKeys(data)
    // lean は schema default を補完しないため、legacy で欠損可能なのは status と wire optional channel だけ。
    expectAllRequiredCharacterRuntimeKeys(data, ['status', 'discordChannelId'])
    for (const sectionName of ['status', 'skill', 'parameter', 'item', 'description']) {
      expect(data).not.toHaveProperty(sectionName)
    }
  })

  it('GET /character/summaries は repository 射影由来の summary wire と meta を返す', async () => {
    characterService.findUserCharacterSummaries.mockResolvedValueOnce([
      {
        characterId: 'character-summary-id',
        characterName: 'Summary Character',
        gameSystemId: 'coc7',
        templateVersion: '2.0.0',
        hub: { status: 'active' }
      },
      {
        characterId: 'character-summary-legacy-id',
        characterName: 'Legacy Summary Character',
        gameSystemId: 'coc6'
      }
    ])

    const response = await request(app.getHttpServer()).get('/character/summaries').expect(200)
    const body = response.body as JsonObject
    const data = body.data as JsonObject[]

    expectSuccessEnvelope(body, 'キャラクターサマリーを取得しました', ['meta'])
    expect(body.meta).toEqual({
      total: 2,
      page: 1,
      limit: 2,
      hasNext: false,
      hasPrev: false
    })
    for (const summary of data) {
      expectOnlyCharacterSummaryRuntimeKeys(summary)
    }
    expect(Object.keys(data[0]).sort()).toEqual([...characterSummaryRuntimeKeys].sort())
    expect(Object.keys(data[1]).sort()).toEqual(['characterId', 'characterName', 'gameSystemId'].sort())
    expect(characterService.findUserCharacterSummaries).toHaveBeenCalledWith(authenticatedUser.discordUserId)
  })
})
