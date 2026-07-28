import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common'
import { FILTER_CATCH_EXCEPTIONS } from '@nestjs/common/constants'
import { Response } from 'express'
import { HttpExceptionFilter } from './http-exception.filter'
import { ApiError } from './api-error'
import { ApiResponseUtil } from '../../utils/api-response.util'

/**
 * HttpExceptionFilter 単体テスト。
 *
 * 「与えた例外 → ApiResponseUtil.error と同一の envelope / status」になることを保証する。
 * requestId(uuid) と timestamp は実行毎に変わるため比較対象から除外する。
 */
describe('HttpExceptionFilter', () => {
  // P1-C: filter は AppConfigService から dev 判定（includeStack）を得る。
  // test 環境想定で非 development を返す＝stack 非含有（ApiResponseUtil.error の既定と一致）。
  const mockAppConfig = {
    get: (path: string) => (path === 'app.environment' ? 'test' : undefined)
  } as unknown as import('../../config/config.service').AppConfigService

  const createResponse = (): { res: Response; status: jest.Mock; json: jest.Mock } => {
    const status = jest.fn().mockReturnThis()
    const json = jest.fn().mockReturnThis()
    const res = { status, json } as unknown as Response
    return { res, status, json }
  }

  const createHost = (res: Response): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({})
      })
    }) as unknown as ArgumentsHost

  /** requestId / timestamp を除いた比較用オブジェクトを取り出す */
  const stripVolatile = (payload: any): Record<string, unknown> => {
    const { requestId, timestamp, ...rest } = payload
    return rest
  }

  it('UnauthorizedException は 401 と例外メッセージを維持する', () => {
    const { res, status, json } = createResponse()
    const filter = new HttpExceptionFilter(mockAppConfig)

    filter.catch(new UnauthorizedException('無効な認証トークンです'), createHost(res))

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED)
    expect(json.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: '無効な認証トークンです'
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
      const { res, status, json } = createResponse()
      const filter = new HttpExceptionFilter(mockAppConfig)

      filter.catch(exception, createHost(res))

      expect(status).toHaveBeenCalledWith(expectedStatus)
      expect(json.mock.calls[0][0].error).toBe(expectedError)
    }
  )

  it.each([
    { environment: 'development', expectedStack: true },
    { environment: 'test', expectedStack: false }
  ])('app.environment=$environment の stack 有無を反映する', ({ environment, expectedStack }) => {
    const { res, json } = createResponse()
    const configService = {
      get: (path: string) => (path === 'app.environment' ? environment : undefined)
    } as unknown as import('../../config/config.service').AppConfigService
    const filter = new HttpExceptionFilter(configService)
    const exception = new HttpException('stack-target', HttpStatus.CONFLICT)

    filter.catch(exception, createHost(res))

    const payload = json.mock.calls[0][0]
    if (expectedStack) {
      expect(payload.stack).toBe(exception.stack)
    } else {
      expect(payload.stack).toBeUndefined()
    }
  })

  it('HttpException のみを捕捉対象として宣言する', () => {
    expect(Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, HttpExceptionFilter)).toEqual([HttpException])
  })

  it('ApiError(404, label, 文字列) → ApiResponseUtil.error(res, 文字列, 404, label) と一致', () => {
    const { res, status, json } = createResponse()
    const filter = new HttpExceptionFilter(mockAppConfig)

    filter.catch(new ApiError(404, 'エラーが発生しました', 'ユーザーが見つかりません'), createHost(res))

    const { res: expectedRes, json: expJson } = createResponse()
    ApiResponseUtil.error(expectedRes, 'ユーザーが見つかりません', 404, 'エラーが発生しました')

    expect(status).toHaveBeenCalledWith(404)
    expect(stripVolatile(json.mock.calls[0][0])).toEqual(stripVolatile(expJson.mock.calls[0][0]))
    // ApiError は @ApiErrorResponse メタより優先される
    expect(json.mock.calls[0][0].error).toBe('ユーザーが見つかりません')
  })

  it('BadRequestException は 400 と object response の message を維持する', () => {
    const { res, status, json } = createResponse()
    const filter = new HttpExceptionFilter(mockAppConfig)

    filter.catch(new BadRequestException('認証コードが指定されていません'), createHost(res))

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    expect(json.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        success: false,
        message: 'エラーが発生しました',
        error: '認証コードが指定されていません'
      })
    )
  })
})
