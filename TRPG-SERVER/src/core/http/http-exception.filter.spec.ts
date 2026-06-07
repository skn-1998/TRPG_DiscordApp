import { ArgumentsHost, BadRequestException, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Response } from 'express'
import { HttpExceptionFilter } from './http-exception.filter'
import { API_ERROR_RESPONSE_KEY } from './api-error-response.decorator'
import { ApiError } from './api-error'
import { ApiResponseUtil } from '../../utils/api-response.util'

/**
 * HttpExceptionFilter 単体テスト。
 *
 * 「与えた例外 → ApiResponseUtil.error と同一の envelope / status」になることを保証する。
 * requestId(uuid) と timestamp は実行毎に変わるため比較対象から除外する。
 */
describe('HttpExceptionFilter', () => {
  const handlerFn = function handler(): void {}

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
      }),
      getHandler: () => handlerFn
    }) as unknown as ExecutionContext as ArgumentsHost

  const setupReflector = (meta?: unknown): Reflector => {
    const reflector = new Reflector()
    jest
      .spyOn(reflector, 'get')
      .mockImplementation((key: unknown) => (key === API_ERROR_RESPONSE_KEY ? meta : undefined))
    return reflector
  }

  /** requestId / timestamp を除いた比較用オブジェクトを取り出す */
  const stripVolatile = (payload: any): Record<string, unknown> => {
    const { requestId, timestamp, ...rest } = payload
    return rest
  }

  it('素の Error + @ApiErrorResponse(401, label) → ApiResponseUtil.error(res, error, 401, label) と一致', () => {
    const error = new Error('Invalid token')
    const { res, status, json } = createResponse()
    const filter = new HttpExceptionFilter(
      setupReflector({ status: 401, label: 'トークン検証に失敗しました' }),
      mockAppConfig
    )

    filter.catch(error, createHost(res))

    // 期待値: ApiResponseUtil.error が生成する envelope
    const { res: expectedRes, status: expStatus, json: expJson } = createResponse()
    ApiResponseUtil.error(expectedRes, error, 401, 'トークン検証に失敗しました')

    expect(status).toHaveBeenCalledWith(401)
    expect(expStatus).toHaveBeenCalledWith(401)
    expect(stripVolatile(json.mock.calls[0][0])).toEqual(stripVolatile(expJson.mock.calls[0][0]))
  })

  it('メタ未設定の素の Error → ApiResponseUtil.error の既定 (500 / エラーが発生しました) と一致', () => {
    const error = new Error('boom')
    const { res, status, json } = createResponse()
    const filter = new HttpExceptionFilter(setupReflector(undefined), mockAppConfig)

    filter.catch(error, createHost(res))

    const { res: expectedRes, json: expJson } = createResponse()
    ApiResponseUtil.error(expectedRes, error, 500)

    expect(status).toHaveBeenCalledWith(500)
    expect(stripVolatile(json.mock.calls[0][0])).toEqual(stripVolatile(expJson.mock.calls[0][0]))
  })

  it('ApiError(404, label, 文字列) → ApiResponseUtil.error(res, 文字列, 404, label) と一致', () => {
    const { res, status, json } = createResponse()
    const filter = new HttpExceptionFilter(setupReflector({ status: 500, label: '取得失敗' }), mockAppConfig)

    filter.catch(new ApiError(404, 'エラーが発生しました', 'ユーザーが見つかりません'), createHost(res))

    const { res: expectedRes, json: expJson } = createResponse()
    ApiResponseUtil.error(expectedRes, 'ユーザーが見つかりません', 404, 'エラーが発生しました')

    expect(status).toHaveBeenCalledWith(404)
    expect(stripVolatile(json.mock.calls[0][0])).toEqual(stripVolatile(expJson.mock.calls[0][0]))
    // ApiError は @ApiErrorResponse メタより優先される
    expect(json.mock.calls[0][0].error).toBe('ユーザーが見つかりません')
  })

  it('BadRequestException + fallback 401 → status 401 / label 適用（変換前 catch が全エラーを潰す挙動を保存）', () => {
    const { res, status, json } = createResponse()
    const filter = new HttpExceptionFilter(
      setupReflector({ status: 401, label: 'ログインに失敗しました' }),
      mockAppConfig
    )

    filter.catch(new BadRequestException('認証コードが指定されていません'), createHost(res))

    expect(status).toHaveBeenCalledWith(401)
    expect(json.mock.calls[0][0]).toEqual(
      expect.objectContaining({ success: false, message: 'ログインに失敗しました' })
    )
  })
})
