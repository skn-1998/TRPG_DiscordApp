import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import {
  CharacterHttpExceptionFilter,
  CharacterAuthenticationException,
  CharacterNotFoundException
} from './character-http.exception'

/**
 * CharacterHttpExceptionFilter は例外型に応じて status と Response DTO 種別を出し分ける純ロジック。
 * 副作用の境界（host.switchToHttp().getResponse()）のみモックし、status コードと
 * json ペイロードの種別（errorCode）を検証する。例外クラスは整形ロジックを直接検証する。
 */
describe('CharacterHttpExceptionFilter', () => {
  let filter: CharacterHttpExceptionFilter
  let res: { status: jest.Mock; json: jest.Mock }
  let host: ArgumentsHost

  beforeEach(() => {
    // P1-C: filter は AppConfigService から dev 判定を得る。test 環境想定で非 development。
    const mockAppConfig = {
      get: (path: string) => (path === 'app.environment' ? 'test' : undefined)
    } as unknown as import('../../config/config.service').AppConfigService
    filter = new CharacterHttpExceptionFilter(mockAppConfig)
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    // ArgumentsHost は switchToHttp().getResponse() の経路のみ使うので最小モック
    host = {
      switchToHttp: () => ({
        getResponse: () => res as unknown as Response
      })
    } as unknown as ArgumentsHost
  })

  const lastJson = () => res.json.mock.calls[0][0]

  describe('catch', () => {
    it('CharacterAuthenticationException は 401・AUTHENTICATION_ERROR で userMessage を error に入れる', () => {
      // Arrange
      const exception = new CharacterAuthenticationException('ログインが必要です')

      // Act
      filter.catch(exception, host)

      // Assert
      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED)
      const payload = lastJson()
      expect(payload.errorCode).toBe('AUTHENTICATION_ERROR')
      expect(payload.error).toBe('ログインが必要です')
    })

    it('CharacterNotFoundException は 404・NOT_FOUND_ERROR で resource を error 文に埋め込む', () => {
      const exception = new CharacterNotFoundException('キャラクター')

      filter.catch(exception, host)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
      const payload = lastJson()
      expect(payload.errorCode).toBe('NOT_FOUND_ERROR')
      expect(payload.error).toBe('キャラクターが見つかりません')
    })

    it('素の Error は 500・INTERNAL_SERVER_ERROR で message を抽出する', () => {
      filter.catch(new Error('予期せぬ障害'), host)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      const payload = lastJson()
      expect(payload.errorCode).toBe('INTERNAL_SERVER_ERROR')
      expect(payload.error).toBe('予期せぬ障害')
    })

    it('非 Error 値も 500 で String 化して error に入れる', () => {
      filter.catch('ただの文字列', host)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(lastJson().error).toBe('ただの文字列')
    })
  })
})

describe('CharacterAuthenticationException', () => {
  it('HttpException を継承し 401 ステータスを持つ', () => {
    const exception = new CharacterAuthenticationException('認証エラー')

    expect(exception).toBeInstanceOf(HttpException)
    expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
  })

  it('userMessage を保持しメッセージ本文にも反映する', () => {
    const exception = new CharacterAuthenticationException('認証エラー')

    expect(exception.userMessage).toBe('認証エラー')
    expect(exception.message).toBe('認証エラー')
  })
})

describe('CharacterNotFoundException', () => {
  it('HttpException を継承し 404 ステータスを持つ', () => {
    const exception = new CharacterNotFoundException('セッション')

    expect(exception).toBeInstanceOf(HttpException)
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND)
  })

  it('resource を保持し「○○が見つかりません」の形にメッセージを整形する', () => {
    const exception = new CharacterNotFoundException('セッション')

    expect(exception.resource).toBe('セッション')
    expect(exception.message).toBe('セッションが見つかりません')
  })
})
