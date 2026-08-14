import { ExecutionContext, INestApplication, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import type { ErrorEnvelope } from '@trpg/api-contract'
import { Request } from 'express'
import request from 'supertest'
import { AppConfigService } from '../../../config/config.service'
import { APP_GLOBAL_EXCEPTION_FILTER_PROVIDER } from '../../../core/http/global-exception.filter'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { DicePreviewController } from './dice-preview.controller'
import { DicePreviewService } from './dice-preview.service'
import { DicePreviewRateLimitGuard } from './guards/dice-preview-rate-limit.guard'

/**
 * dice preview の HTTP routing と JWT 必須契約を検証する。
 * BCDice 実行と rate limit 本体は各単体 spec に分離する。
 */
describe('DicePreviewController', () => {
  const authenticatedUser = { discordUserId: 'preview-user', username: 'tester' }
  const dicePreviewService = { preview: jest.fn() }
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DicePreviewController],
      providers: [
        { provide: DicePreviewService, useValue: dicePreviewService },
        { provide: AppConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
        APP_GLOBAL_EXCEPTION_FILTER_PROVIDER
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<Request>()
          if (!req.headers.authorization) {
            throw new UnauthorizedException('認証ヘッダーまたはクッキーが必要です')
          }
          req.user = authenticatedUser
          return true
        }
      })
      .overrideGuard(DicePreviewRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  beforeEach(() => {
    dicePreviewService.preview.mockReset()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /dice-roll/preview は補間済み式を service へ渡し、評価済み total をそのまま返す', async () => {
    dicePreviewService.preview.mockResolvedValue({ total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' })

    const response = await request(app.getHttpServer())
      .post('/dice-roll/preview')
      .set('Authorization', 'Bearer test-token')
      .send({ notation: '3d6*5', gameSystemId: 'DiceBot' })
      .expect(200)

    expect(response.body).toEqual({ total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' })
    expect(dicePreviewService.preview).toHaveBeenCalledWith({ notation: '3d6*5', gameSystemId: 'DiceBot' })
  })

  it('JWT が無い request は 401 で service を呼ばない', async () => {
    await request(app.getHttpServer()).post('/dice-roll/preview').send({ notation: '1d6' }).expect(401)

    expect(dicePreviewService.preview).not.toHaveBeenCalled()
  })

  it('service の 422 は GlobalExceptionFilter を通り ErrorEnvelope で返る', async () => {
    dicePreviewService.preview.mockRejectedValue(new UnprocessableEntityException(['invalid notation']))

    const response = await request(app.getHttpServer())
      .post('/dice-roll/preview')
      .set('Authorization', 'Bearer test-token')
      .send({ notation: '1d6' })
      .expect(422)
    const body = response.body as ErrorEnvelope

    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: 'invalid notation',
        details: [{ message: 'invalid notation' }]
      })
    )
    expect(body.timestamp).toEqual(expect.any(Number))
    expect(body.requestId).toEqual(expect.any(String))
    expect(body).not.toHaveProperty('statusCode')
  })
})
