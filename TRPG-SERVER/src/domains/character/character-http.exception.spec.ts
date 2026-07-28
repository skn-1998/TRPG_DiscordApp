import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common'
import { FILTER_CATCH_EXCEPTIONS } from '@nestjs/common/constants'
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
      }),
      getHandler: () => null
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

    it('その他の UnauthorizedException は 401 と例外メッセージを維持する', () => {
      filter.catch(new UnauthorizedException('無効な認証トークンです'), host)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED)
      expect(lastJson()).toEqual(
        expect.objectContaining({
          success: false,
          message: 'エラーが発生しました',
          error: '無効な認証トークンです'
        })
      )
    })

    it('その他の BadRequestException は 400 と object response の message を維持する', () => {
      filter.catch(new BadRequestException('入力値が不正です'), host)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
      expect(lastJson()).toEqual(
        expect.objectContaining({
          success: false,
          message: 'エラーが発生しました',
          error: '入力値が不正です'
        })
      )
    })

    it.each([
      {
        caseName: '文字列 response',
        exception: new HttpException('plain-string', HttpStatus.CONFLICT),
        expectedStatus: HttpStatus.CONFLICT,
        expectedError: 'plain-string'
      },
      {
        caseName: '配列 message',
        exception: new BadRequestException(['a', 'b']),
        expectedStatus: HttpStatus.BAD_REQUEST,
        expectedError: 'a, b'
      },
      {
        caseName: '数値 message',
        exception: new HttpException({ message: 123 }, HttpStatus.BAD_REQUEST),
        expectedStatus: HttpStatus.BAD_REQUEST,
        expectedError: '123'
      }
    ])(
      '$caseName は status=$expectedStatus・error=$expectedError に整形する',
      ({ exception, expectedStatus, expectedError }) => {
        filter.catch(exception, host)

        expect(res.status).toHaveBeenCalledWith(expectedStatus)
        expect(lastJson().error).toBe(expectedError)
      }
    )

    it.each([
      { environment: 'development', expectedStack: true },
      { environment: 'test', expectedStack: false }
    ])('app.environment=$environment の stack 有無を反映する', ({ environment, expectedStack }) => {
      const configService = {
        get: (path: string) => (path === 'app.environment' ? environment : undefined)
      } as unknown as import('../../config/config.service').AppConfigService
      const environmentFilter = new CharacterHttpExceptionFilter(configService)
      const exception = new HttpException('stack-target', HttpStatus.CONFLICT)

      environmentFilter.catch(exception, host)

      const payload = lastJson()
      if (expectedStack) {
        expect(payload.stack).toBe(exception.stack)
      } else {
        expect(payload.stack).toBeUndefined()
      }
    })

    it('HttpException のみを捕捉対象として宣言する', () => {
      expect(Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, CharacterHttpExceptionFilter)).toEqual([HttpException])
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
