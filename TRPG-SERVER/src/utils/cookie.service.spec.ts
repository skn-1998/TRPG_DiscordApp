import { Response } from 'express'
import { CookieService } from './cookie.service'

/**
 * CookieService は res.cookie / res.clearCookie を呼ぶだけの薄いサービス。
 * 副作用の境界（Response）のみモックし、isProduction による secure/sameSite 切替と
 * 固定オプション（httpOnly/path/maxAge）を検証する。
 */
describe('CookieService', () => {
  let service: CookieService
  let res: { cookie: jest.Mock; clearCookie: jest.Mock }
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

  beforeEach(() => {
    service = new CookieService()
    res = { cookie: jest.fn(), clearCookie: jest.fn() }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('setJwtCookie', () => {
    it('本番環境では secure=true・sameSite=none で jwt を設定する', () => {
      // Act
      service.setJwtCookie(res as unknown as Response, 'token-abc', true)

      // Assert
      expect(res.cookie).toHaveBeenCalledWith('jwt', 'token-abc', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: SEVEN_DAYS_MS
      })
    })

    it('非本番環境では secure=false・sameSite=lax で jwt を設定する', () => {
      service.setJwtCookie(res as unknown as Response, 'token-xyz', false)

      expect(res.cookie).toHaveBeenCalledWith('jwt', 'token-xyz', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: SEVEN_DAYS_MS
      })
    })
  })

  describe('clearJwtCookie', () => {
    it('jwt クッキーを path 指定で削除する', () => {
      service.clearJwtCookie(res as unknown as Response)

      expect(res.clearCookie).toHaveBeenCalledWith('jwt', { path: '/' })
    })
  })
})
