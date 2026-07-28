import { ExecutionContext, INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Request } from 'express'
import request from 'supertest'
import { JwtAuthGuard } from '../../../domains/auth/guards/jwt-auth.guard'
import {
  CHARACTER_INSTANTIATION_USE_CASE,
  CHARACTER_SHEET_OPERATION_USE_CASE,
  CharacterSheetController
} from '../../../domains/character/character.controller'
import { CharacterService } from '../../../domains/character/character.service'

describe('CharacterSheetController success response contract', () => {
  const createHttpApp = async (saveSheet: jest.Mock, instantiate: jest.Mock): Promise<INestApplication> => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterSheetController],
      providers: [
        {
          provide: CharacterService,
          useValue: { findOneForOwner: jest.fn().mockResolvedValue({ characterId: 'character-1' }) }
        },
        { provide: CHARACTER_SHEET_OPERATION_USE_CASE, useValue: { saveSheet } },
        { provide: CHARACTER_INSTANTIATION_USE_CASE, useValue: { instantiate } }
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

  const expectEnvelopeKeys = (body: Record<string, unknown>): void => {
    expect(Object.keys(body).sort()).toEqual(['data', 'message', 'requestId', 'success', 'timestamp'])
    expect(body.success).toBe(true)
    expect(body.timestamp).toEqual(expect.any(Number))
    expect(body.requestId).toEqual(expect.any(String))
    expect(body).not.toHaveProperty('meta')
  }

  it('PUT /character/:id/sheet は 200 の単一封筒に保存 payload を保つ', async () => {
    const saveResult = {
      character: { characterId: 'character-1', characterName: 'Alice' },
      revision: 2,
      noOp: false,
      appliedChanges: 1
    }
    const saveSheet = jest.fn().mockResolvedValue(saveResult)
    const app = await createHttpApp(saveSheet, jest.fn())

    try {
      const response = await request(app.getHttpServer())
        .put('/character/character-1/sheet')
        .send({
          baseRevision: 1,
          changes: [{ path: { fieldUid: 'uid-hp' }, baseValue: 10, newValue: 9 }]
        })
        .expect(200)

      expectEnvelopeKeys(response.body)
      expect(response.body.message).toBe('キャラクターシートを保存しました')
      expect(response.body.data).toEqual(saveResult)
      expect(response.body.data.data).toBeUndefined()
    } finally {
      await app.close()
    }
  })

  it('POST /character/from-template は 201 の単一封筒に characterId を返す', async () => {
    const instantiate = jest.fn().mockResolvedValue({
      character: { characterId: 'created-character-1' }
    })
    const app = await createHttpApp(jest.fn(), instantiate)

    try {
      const response = await request(app.getHttpServer())
        .post('/character/from-template')
        .send({
          templateId: 'template-1',
          templateVersion: '1.0.0',
          characterName: 'Alice',
          values: { 'uid-hp': 10 }
        })
        .expect(201)

      expectEnvelopeKeys(response.body)
      expect(response.body.message).toBe('キャラクターを作成しました')
      expect(response.body.data).toEqual({ characterId: 'created-character-1' })
      expect(response.body.data.data).toBeUndefined()
    } finally {
      await app.close()
    }
  })
})
