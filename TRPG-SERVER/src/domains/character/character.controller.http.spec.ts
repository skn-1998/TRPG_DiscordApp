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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CharacterHttpExceptionFilter } from './character-http.exception'
import { CharacterController } from './character.controller'
import { CharacterService } from './character.service'

/**
 * CharacterController の実 HTTP 成功応答を検証する。
 * service 境界だけをモックし、guard override、実 interceptor、実 character filter を通す。
 */
describe('CharacterController HTTP payload contract', () => {
  const authenticatedUser = {
    username: 'character-http-user',
    discordUserId: 'character-http-user-id'
  }
  const characterService = {
    findOneForOwner: jest.fn(),
    findUserCharacterSummaries: jest.fn()
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
        CharacterHttpExceptionFilter,
        ResponseInterceptor
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
    characterService.findOneForOwner.mockReset()
    characterService.findUserCharacterSummaries.mockReset()
  })

  afterAll(async () => {
    await app.close()
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
