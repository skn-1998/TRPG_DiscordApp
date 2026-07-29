import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { HttpExceptionFilter } from '../../core/http'
import { CharacterAuthenticationException, CharacterNotFoundException } from './character-http.exception'

/**
 * Character の ApiError を共通 HttpExceptionFilter に通し、旧 wire 封筒との等価性を固定する。
 * errorPayload は文字列なので、development でも JSON wire に stack が現れないことを検証する。
 */
describe('HttpExceptionFilter × Character exceptions', () => {
  let filter: HttpExceptionFilter
  let res: { status: jest.Mock; json: jest.Mock }
  let host: ArgumentsHost

  beforeEach(() => {
    const mockAppConfig = {
      get: (path: string) => (path === 'app.environment' ? 'development' : undefined)
    } as unknown as import('../../config/config.service').AppConfigService
    filter = new HttpExceptionFilter(mockAppConfig)
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    // ArgumentsHost は switchToHttp().getResponse() の経路のみ使うので最小モック
    host = {
      switchToHttp: () => ({
        getResponse: () => res as unknown as Response
      }),
      getHandler: () => null
    } as unknown as ArgumentsHost
  })

  const lastJson = () => res.json.mock.calls[0][0]
  const lastWire = (): Record<string, unknown> => JSON.parse(JSON.stringify(lastJson()))

  describe('catch', () => {
    it('CharacterAuthenticationException は旧 401 wire とバイト等価なフィールドを返す', () => {
      const exception = new CharacterAuthenticationException('ログインが必要です')

      filter.catch(exception, host)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED)
      expect(lastWire()).toEqual({
        success: false,
        message: '認証エラー',
        timestamp: expect.any(Number),
        requestId: expect.any(String),
        error: 'ログインが必要です',
        errorCode: 'AUTHENTICATION_ERROR'
      })
      expect(JSON.stringify(lastJson())).not.toContain('"stack"')
    })

    it('CharacterNotFoundException は旧 404 wire とバイト等価なフィールドを返す', () => {
      const exception = new CharacterNotFoundException('キャラクター')

      filter.catch(exception, host)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
      expect(lastWire()).toEqual({
        success: false,
        message: '未発見エラー',
        timestamp: expect.any(Number),
        requestId: expect.any(String),
        error: 'キャラクターが見つかりません',
        errorCode: 'NOT_FOUND_ERROR'
      })
      expect(JSON.stringify(lastJson())).not.toContain('"stack"')
    })
  })
})

describe('CharacterAuthenticationException', () => {
  it('HttpException を継承し 401 ステータスを持つ', () => {
    const exception = new CharacterAuthenticationException('認証エラー')

    expect(exception).toBeInstanceOf(HttpException)
    expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
  })

  it('userMessage を保持し message は wire label を示す', () => {
    const exception = new CharacterAuthenticationException('ログインが必要です')

    expect(exception.userMessage).toBe('ログインが必要です')
    expect(exception.message).toBe('認証エラー')
  })
})

describe('CharacterNotFoundException', () => {
  it('HttpException を継承し 404 ステータスを持つ', () => {
    const exception = new CharacterNotFoundException('セッション')

    expect(exception).toBeInstanceOf(HttpException)
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND)
  })

  it('resource を保持し message は wire label を示す', () => {
    const exception = new CharacterNotFoundException('セッション')

    expect(exception.resource).toBe('セッション')
    expect(exception.message).toBe('未発見エラー')
  })
})
