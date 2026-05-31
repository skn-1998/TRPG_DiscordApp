import { CallHandler, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { lastValueFrom, of } from 'rxjs'
import { ResponseInterceptor } from './response.interceptor'
import { RESPONSE_MESSAGE_KEY } from './response-message.decorator'
import { SKIP_RESPONSE_WRAPPER_KEY } from './skip-response-wrapper.decorator'
import { SuccessResponse } from '../dto/api-response.dto'

/**
 * ResponseInterceptor 単体テスト。
 *
 * 変換前の ApiResponseUtil.success(res, data, domain, 200, message) が生成していた
 * SuccessResponse と「同一の envelope」を、ハンドラ戻り値から生成できることを保証する。
 */
describe('ResponseInterceptor', () => {
  const handlerFn = function handler(): void {}

  const createContext = (): ExecutionContext =>
    ({
      getHandler: () => handlerFn
    }) as unknown as ExecutionContext

  const createNext = (value: unknown): CallHandler =>
    ({
      handle: () => of(value)
    }) as CallHandler

  const setupReflector = (overrides: Partial<Record<string, unknown>> = {}): Reflector => {
    const reflector = new Reflector()
    jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => overrides[key as string])
    return reflector
  }

  it('戻り値を SuccessResponse でラップし、ApiResponseUtil.success と同形になる', async () => {
    const reflector = setupReflector()
    const interceptor = new ResponseInterceptor(reflector)
    const data = { foo: 'bar' }

    const result = await lastValueFrom(interceptor.intercept(createContext(), createNext(data)))

    expect(result).toBeInstanceOf(SuccessResponse)
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        message: '成功',
        data
      })
    )
    // ApiResponseUtil.success 同様 requestId(uuid) と timestamp を持つ
    expect((result as SuccessResponse).requestId).toEqual(expect.any(String))
    expect((result as SuccessResponse).timestamp).toEqual(expect.any(Number))
  })

  it('@ResponseMessage のメタデータがあれば message に反映する', async () => {
    const reflector = setupReflector({ [RESPONSE_MESSAGE_KEY]: '認証成功' })
    const interceptor = new ResponseInterceptor(reflector)

    const result = await lastValueFrom(interceptor.intercept(createContext(), createNext({ token: 't' })))

    expect((result as SuccessResponse).message).toBe('認証成功')
  })

  it('@SkipResponseWrapper があれば封筒化せず素通しする', async () => {
    const reflector = setupReflector({ [SKIP_RESPONSE_WRAPPER_KEY]: true })
    const interceptor = new ResponseInterceptor(reflector)

    const result = await lastValueFrom(interceptor.intercept(createContext(), createNext(undefined)))

    expect(result).toBeUndefined()
  })

  it('既に SuccessResponse の場合は二重ラップしない', async () => {
    const reflector = setupReflector()
    const interceptor = new ResponseInterceptor(reflector)
    const envelope = new SuccessResponse({ a: 1 }, '既存', undefined, 'req-1')

    const result = await lastValueFrom(interceptor.intercept(createContext(), createNext(envelope)))

    expect(result).toBe(envelope)
  })
})
