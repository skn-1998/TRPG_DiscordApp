/**
 * CharacterSheetController の nested DTO が実 HTTP 境界で whitelist 処理されることを検証する。
 *
 * NOTE: コロケーション規約の例外 - 並行 api-contract セッションが
 * `character.controller.http.spec.ts` を所有しているため、この feature 側 spec に配置している。
 */
import { ExecutionContext, INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Request } from 'express'
import request from 'supertest'
import { APP_VALIDATION_PIPE_PROVIDER } from '../../../core/http/validation-pipe.provider'
import { JwtAuthGuard } from '../../../domains/auth/guards/jwt-auth.guard'
import {
  CHARACTER_INSTANTIATION_USE_CASE,
  CHARACTER_SHEET_OPERATION_USE_CASE,
  CharacterSheetController
} from '../character-sheet.controller'
import { CharacterService } from '../../../domains/character/character.service'

describe('CharacterSheetController HTTP validation', () => {
  // 第3群-a の whitelist strip の単独因果はこの test が担う。削除・簡略化時は auth.controller.http.spec.ts のコメントも更新すること。
  it('PUT /character/:id/sheet は APP_PIPE の whitelist で changes と path の未知フィールドを除去する', async () => {
    const characterId = 'character-http-validation'
    const characterService = {
      findOneForOwner: jest.fn().mockResolvedValue({ characterId })
    }
    const saveSheet = jest.fn().mockResolvedValue({ noOp: false, revision: 2 })
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterSheetController],
      providers: [
        { provide: CharacterService, useValue: characterService },
        { provide: CHARACTER_SHEET_OPERATION_USE_CASE, useValue: { saveSheet } },
        { provide: CHARACTER_INSTANTIATION_USE_CASE, useValue: { instantiate: jest.fn() } },
        APP_VALIDATION_PIPE_PROVIDER
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
      await request(app.getHttpServer())
        .put(`/character/${characterId}/sheet`)
        .send({
          baseRevision: 1,
          changes: [
            {
              path: {
                fieldUid: 'uid-denominator',
                injectedPath: 'must be stripped'
              },
              baseValue: 1,
              newValue: 2,
              injected: 'must be stripped'
            }
          ]
        })
        .expect(200)
    } finally {
      await app.close()
    }

    expect(characterService.findOneForOwner).toHaveBeenCalledWith(characterId, 'owner-1')
    expect(saveSheet).toHaveBeenCalledTimes(1)
    expect(saveSheet).toHaveBeenCalledWith({
      characterId,
      baseRevision: 1,
      changes: [
        {
          path: { fieldUid: 'uid-denominator' },
          baseValue: 1,
          newValue: 2
        }
      ]
    })
  })

  // 振り直し DTO に値の受け口が無いことを HTTP 境界で固定する。
  // 値の入口が復活すると、クライアントが任意の数値をダイスの出目として保存できてしまう。
  it('POST /character/:id/sheet/reroll は APP_PIPE の whitelist で値プロパティを除去する', async () => {
    const characterId = 'character-http-reroll'
    const rerollCreationRoll = jest.fn().mockResolvedValue({ revision: 2, total: 55 })
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterSheetController],
      providers: [
        { provide: CharacterService, useValue: { findOneForOwner: jest.fn() } },
        { provide: CHARACTER_SHEET_OPERATION_USE_CASE, useValue: { saveSheet: jest.fn(), rerollCreationRoll } },
        { provide: CHARACTER_INSTANTIATION_USE_CASE, useValue: { instantiate: jest.fn() } },
        APP_VALIDATION_PIPE_PROVIDER
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
      await request(app.getHttpServer())
        .post(`/character/${characterId}/sheet/reroll`)
        .send({
          fieldUid: 'uid-hp',
          baseRevision: 1,
          value: 100,
          total: 100
        })
        .expect(200)
    } finally {
      await app.close()
    }

    expect(rerollCreationRoll).toHaveBeenCalledTimes(1)
    expect(rerollCreationRoll).toHaveBeenCalledWith({
      characterId,
      requesterDiscordUserId: 'owner-1',
      fieldUid: 'uid-hp',
      baseRevision: 1
    })
  })
})
