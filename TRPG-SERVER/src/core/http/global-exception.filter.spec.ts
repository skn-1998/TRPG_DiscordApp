import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpException,
  HttpStatus,
  INestApplication,
  Logger,
  NotFoundException,
  Post,
  Res,
  UnauthorizedException,
  UnprocessableEntityException,
  UseFilters
} from '@nestjs/common'
import { FILTER_CATCH_EXCEPTIONS } from '@nestjs/common/constants'
import { Test } from '@nestjs/testing'
import { IsInt, IsString } from 'class-validator'
import type { Response } from 'express'
import request from 'supertest'
import { AppConfigService } from '../../config/config.service'
import {
  CharacterAuthenticationException,
  CharacterNotFoundException
} from '../../domains/character/character-http.exception'
import { ApiResponseUtil } from '../../utils/api-response.util'
import { ApiError } from './api-error'
import { APP_VALIDATION_PIPE_PROVIDER } from './validation-pipe.provider'
import {
  APP_GLOBAL_EXCEPTION_FILTER_PROVIDER,
  GLOBAL_INTERNAL_ERROR_MESSAGE,
  GlobalExceptionFilter
} from './global-exception.filter'

class ValidationTestDto {
  @IsString()
  readonly value!: string

  @IsInt()
  readonly count!: number
}

@Controller('global-exception-filter')
class GlobalExceptionFilterTestController {
  @Get('object-body')
  throwObjectBody(): never {
    throw new UnprocessableEntityException({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'm',
      issues: [{ fieldUid: 'u', path: ['u'], message: 'im' }]
    })
  }

  @Get('string-body')
  throwStringBody(): never {
    throw new HttpException('権限がありません', 403)
  }

  @Get('named-exception')
  throwNamedException(): never {
    throw new NotFoundException('x not found')
  }

  @Get('api-error')
  throwApiError(): never {
    throw new ApiError(409, '競合エラー', 'リソースが競合しています', 'CONFLICT_ERROR')
  }

  @Get('unknown-error')
  throwUnknownError(): never {
    throw new Error('boom-internal-detail')
  }

  @Get('throw-string')
  throwString(): never {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- 非 Error throw の封筒化が本テストの対象
    throw 'str'
  }

  @Get('throw-null')
  throwNull(): never {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- 非 Error throw の封筒化が本テストの対象
    throw null
  }

  @Get('throw-null-prototype')
  throwNullPrototype(): never {
    throw Object.create(null)
  }

  @Get('throw-hostile-to-string')
  throwHostileToString(): never {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- 非 Error throw の封筒化が本テストの対象
    throw {
      toString: () => {
        throw new Error('hostile-to-string-detail')
      }
    }
  }

  @Get('throw-hostile-http-error')
  throwHostileHttpError(): never {
    let statusCodeAccessCount = 0
    const hostileHttpError = {
      get statusCode(): number {
        statusCodeAccessCount += 1
        if (statusCodeAccessCount === 3) {
          throw new Error('hostile-status-code-detail')
        }
        return 413
      },
      message: 'hostile-http-error-detail'
    } as unknown as Error

    throw hostileHttpError
  }

  @Get('throw-plain-http-error')
  throwPlainHttpError(): never {
    const plainHttpError = {
      statusCode: 413,
      message: 'plain-http-error-message'
    } as unknown as Error

    throw plainHttpError
  }

  @Get('headers-sent')
  throwAfterHeadersSent(@Res() response: Response): never {
    response.write('partial-')
    throw new Error('after-headers-detail')
  }

  @Post('validation')
  validate(@Body() body: ValidationTestDto): ValidationTestDto {
    return body
  }

  @Post('body-limit')
  acceptBody(@Body() body: Record<string, unknown>): Record<string, unknown> {
    return body
  }
}

@Catch()
class ControllerScopedTestFilter implements ExceptionFilter {
  catch(_exception: unknown, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(418).json({
      source: 'controller-filter'
    })
  }
}

@Controller('controller-filter')
@UseFilters(new ControllerScopedTestFilter())
class ControllerFilterTestController {
  @Get()
  throwUnknownError(): never {
    throw new Error('controller-filter-detail')
  }

  @Post('body-limit')
  acceptBody(@Body() body: Record<string, unknown>): Record<string, unknown> {
    return body
  }
}

/**
 * APP_FILTER provider 経由の実 HTTP 経路で、E1a の直列化境界を固定する。
 */
describe('GlobalExceptionFilter', () => {
  const appConfigService = {
    get: jest.fn()
  }

  let app: INestApplication
  let errorSpy: jest.SpyInstance

  beforeAll(async () => {
    appConfigService.get.mockReturnValue('test')

    const module = await Test.createTestingModule({
      controllers: [GlobalExceptionFilterTestController, ControllerFilterTestController],
      providers: [
        { provide: AppConfigService, useValue: appConfigService },
        APP_VALIDATION_PIPE_PROVIDER,
        APP_GLOBAL_EXCEPTION_FILTER_PROVIDER
      ]
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  beforeEach(() => {
    appConfigService.get.mockReset()
    appConfigService.get.mockReturnValue('test')
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    errorSpy.mockClear()
  })

  afterAll(async () => {
    await app.close()
    errorSpy.mockRestore()
  })

  it('object body の HttpException を封筒化し、局所 filter が保護する issues は引き継がない', async () => {
    const response = await request(app.getHttpServer()).get('/global-exception-filter/object-body').expect(422)

    // 本番の sheet 422 は controller-scoped filter が捕捉するため、global に同等の発生源はない。
    expect(response.body).toStrictEqual({
      success: false,
      message: 'エラーが発生しました',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: 'm'
    })
    expect(response.body).not.toHaveProperty('issues')
  })

  it('string body の HttpException を封筒化する', async () => {
    const response = await request(app.getHttpServer()).get('/global-exception-filter/string-body').expect(403)

    expect(response.body).toStrictEqual({
      success: false,
      message: 'エラーが発生しました',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: '権限がありません'
    })
    expect(response.body).not.toHaveProperty('errorCode')
    expect(response.body).not.toHaveProperty('details')
    expect(response.body).not.toHaveProperty('cause')
  })

  it('名前付き HttpException を封筒化する', async () => {
    const response = await request(app.getHttpServer()).get('/global-exception-filter/named-exception').expect(404)

    expect(response.body).toStrictEqual({
      success: false,
      message: 'エラーが発生しました',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: 'x not found'
    })
  })

  it('実 ValidationPipe の 400 message 配列を details に保存して封筒化する', async () => {
    const response = await request(app.getHttpServer())
      .post('/global-exception-filter/validation')
      .send({ value: 123, count: 'x' })
      .expect(400)

    expect(response.body).toStrictEqual({
      success: false,
      message: 'エラーが発生しました',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: 'value must be a string, count must be an integer number',
      details: [{ message: 'value must be a string' }, { message: 'count must be an integer number' }]
    })
  })

  it('ApiError の label・errorCode・errorPayload を保って封筒化する', async () => {
    const response = await request(app.getHttpServer()).get('/global-exception-filter/api-error').expect(409)

    expect(response.body).toStrictEqual({
      success: false,
      message: '競合エラー',
      timestamp: expect.any(Number),
      requestId: expect.any(String),
      error: 'リソースが競合しています',
      errorCode: 'CONFLICT_ERROR'
    })
  })

  it('Express の http-errors を Nest 既定の形で返す', async () => {
    const response = await request(app.getHttpServer())
      .post('/global-exception-filter/body-limit')
      .send({ payload: 'x'.repeat(101 * 1024) })
      .expect(413)

    expect(response.body).toStrictEqual({
      statusCode: 413,
      message: 'request entity too large'
    })
  })

  it('委譲中に accessor が throw しても応答を終端し、固定 500 封筒へフォールスルーする', async () => {
    const response = await request(app.getHttpServer())
      .get('/global-exception-filter/throw-hostile-http-error')
      .expect(500)

    const serializedBody = JSON.stringify(response.body)
    const serializedLogCalls = JSON.stringify(errorSpy.mock.calls)

    expect(response.body.success).toBe(false)
    expect(response.body.error).toBe(GLOBAL_INTERNAL_ERROR_MESSAGE)
    expect(serializedBody).not.toContain('hostile-http-error-detail')
    expect(serializedBody).not.toContain('hostile-status-code-detail')
    expect(serializedLogCalls).toContain('name=object message=[object Object]')
    expect(serializedLogCalls).toContain(
      'delegationFailureName=Error delegationFailureMessage=hostile-status-code-detail'
    )
  }, 2_000)

  it('良性の http-errors 相当 object は Nest 既定の形で返す', async () => {
    const response = await request(app.getHttpServer())
      .get('/global-exception-filter/throw-plain-http-error')
      .expect(413)

    expect(response.body).toStrictEqual({
      statusCode: 413,
      message: 'plain-http-error-message'
    })
  })

  it('Express の http-errors は controller-scoped filter を貫通して Nest 既定の形で返す', async () => {
    const response = await request(app.getHttpServer())
      .post('/controller-filter/body-limit')
      .send({ payload: 'x'.repeat(101 * 1024) })
      .expect(413)

    expect(response.body).toStrictEqual({
      statusCode: 413,
      message: 'request entity too large'
    })
  })

  it('controller filter は全捕捉 global filter より先に応答する', async () => {
    const response = await request(app.getHttpServer()).get('/controller-filter').expect(418)

    expect(response.body).toStrictEqual({
      source: 'controller-filter'
    })
  })

  it('非 HttpException を raw message と stack のない固定 500 封筒にする', async () => {
    const response = await request(app.getHttpServer()).get('/global-exception-filter/unknown-error').expect(500)

    expect(response.body.success).toBe(false)
    expect(response.body.message).toBe('エラーが発生しました')
    expect(response.body.error).toBe(GLOBAL_INTERNAL_ERROR_MESSAGE)
    expect(typeof response.body.requestId).toBe('string')
    expect(JSON.stringify(response.body)).not.toContain('boom-internal-detail')
    expect(response.body).not.toHaveProperty('stack')
  })

  it.each([
    {
      path: 'throw-string',
      forbiddenBodyText: 'str',
      expectedDiagnostic: 'name=string message=str'
    },
    {
      path: 'throw-null',
      forbiddenBodyText: 'null',
      expectedDiagnostic: 'name=null message=null'
    },
    {
      path: 'throw-null-prototype',
      forbiddenBodyText: 'diagnostic unavailable',
      expectedDiagnostic: 'name=object message=[diagnostic unavailable]'
    },
    {
      path: 'throw-hostile-to-string',
      forbiddenBodyText: 'hostile-to-string-detail',
      expectedDiagnostic: 'name=object message=[diagnostic unavailable]'
    }
  ])('$path の非 Error throw を安全に 500 封筒化する', async ({ path, forbiddenBodyText, expectedDiagnostic }) => {
    const response = await request(app.getHttpServer()).get(`/global-exception-filter/${path}`).expect(500)
    const serializedBody = JSON.stringify(response.body)
    const serializedLogCalls = JSON.stringify(errorSpy.mock.calls)

    expect(response.body.success).toBe(false)
    expect(response.body.error).toBe(GLOBAL_INTERNAL_ERROR_MESSAGE)
    expect(serializedBody).not.toContain(forbiddenBodyText)
    expect(serializedLogCalls).toContain(expectedDiagnostic)
  })

  it('非 HttpException の診断情報をサーバーログに残す', async () => {
    await request(app.getHttpServer()).get('/global-exception-filter/unknown-error').expect(500)

    const serializedLogCalls = JSON.stringify(errorSpy.mock.calls)

    expect(serializedLogCalls).toContain('requestId=')
    expect(serializedLogCalls).toContain('name=Error')
    expect(serializedLogCalls).toContain('message=boom-internal-detail')
    expect(serializedLogCalls).toContain('Error: boom-internal-detail')
  })

  it('logger が throw しても固定 500 封筒を返す', async () => {
    errorSpy.mockImplementationOnce(() => {
      throw new Error('logger-failure-detail')
    })

    const response = await request(app.getHttpServer()).get('/global-exception-filter/unknown-error').expect(500)

    expect(response.body.success).toBe(false)
    expect(response.body.error).toBe(GLOBAL_INTERNAL_ERROR_MESSAGE)
    expect(JSON.stringify(response.body)).not.toContain('logger-failure-detail')
  })

  it('headers 送信後の未知例外でも応答を終端する', async () => {
    const response = await request(app.getHttpServer()).get('/global-exception-filter/headers-sent').expect(200)

    expect(response.text).toBe('partial-')
  }, 2_000)

  it('development では非 HttpException の stack を封筒に含める', async () => {
    appConfigService.get.mockReturnValue('development')

    const response = await request(app.getHttpServer()).get('/global-exception-filter/unknown-error').expect(500)

    expect(response.body.stack).toEqual(expect.any(String))
  })
})

/**
 * 削除する controller-scoped filter の HttpException pin を global 境界へ再ホストする。
 * requestId と timestamp は実行ごとに変わるため、旧オラクルとの比較時だけ除外する。
 */
describe('GlobalExceptionFilter rehosted HttpException pins', () => {
  const mockAppConfig = {
    get: (path: string) => (path === 'app.environment' ? 'test' : undefined)
  } as unknown as AppConfigService

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

  const stripVolatile = (payload: any): Record<string, unknown> => {
    const { requestId, timestamp, ...rest } = payload
    return rest
  }

  it('UnauthorizedException は 401 と例外メッセージを維持する', () => {
    const { res, status, json } = createResponse()
    const filter = new GlobalExceptionFilter(mockAppConfig)

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
      const filter = new GlobalExceptionFilter(mockAppConfig)

      filter.catch(exception, createHost(res))

      expect(status).toHaveBeenCalledWith(expectedStatus)
      expect(json.mock.calls[0][0].error).toBe(expectedError)
    }
  )

  it('app.environment=development では stack を含める', () => {
    const { res, json } = createResponse()
    const configService = {
      get: (path: string) => (path === 'app.environment' ? 'development' : undefined)
    } as unknown as AppConfigService
    const filter = new GlobalExceptionFilter(configService)
    const exception = new HttpException('stack-target', HttpStatus.CONFLICT)

    filter.catch(exception, createHost(res))

    expect(json.mock.calls[0][0].stack).toBe(exception.stack)
  })

  it('app.environment=test では stack を含めない', () => {
    const { res, json } = createResponse()
    const filter = new GlobalExceptionFilter(mockAppConfig)
    const exception = new HttpException('stack-target', HttpStatus.CONFLICT)

    filter.catch(exception, createHost(res))

    expect(json.mock.calls[0][0].stack).toBeUndefined()
  })

  it('全例外を捕捉対象として宣言する', () => {
    expect(Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, GlobalExceptionFilter)).toEqual([])
  })

  it('ApiError(404, label, 文字列) → ApiResponseUtil.error(res, 文字列, 404, label) と一致', () => {
    const { res, status, json } = createResponse()
    const filter = new GlobalExceptionFilter(mockAppConfig)

    filter.catch(new ApiError(404, 'エラーが発生しました', 'ユーザーが見つかりません'), createHost(res))

    const { res: expectedRes, json: expectedJson } = createResponse()
    ApiResponseUtil.error(expectedRes, 'ユーザーが見つかりません', 404, 'エラーが発生しました')

    expect(status).toHaveBeenCalledWith(404)
    expect(stripVolatile(json.mock.calls[0][0])).toEqual(stripVolatile(expectedJson.mock.calls[0][0]))
    expect(json.mock.calls[0][0].error).toBe('ユーザーが見つかりません')
  })

  it('errorCode 付き ApiError は ErrorResponse の wire 封筒へ errorCode を伝播する', () => {
    const { res, json } = createResponse()
    const filter = new GlobalExceptionFilter(mockAppConfig)

    filter.catch(new ApiError(401, '認証エラー', 'ログインが必要です', 'AUTHENTICATION_ERROR'), createHost(res))

    expect(json.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        success: false,
        message: '認証エラー',
        error: 'ログインが必要です',
        errorCode: 'AUTHENTICATION_ERROR'
      })
    )
  })

  it('errorCode なし ApiError は JSON wire に errorCode キーを追加しない', () => {
    const { res, json } = createResponse()
    const filter = new GlobalExceptionFilter(mockAppConfig)

    filter.catch(new ApiError(404, 'エラーが発生しました', 'ユーザーが見つかりません'), createHost(res))

    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('"errorCode"')
  })

  it('BadRequestException は 400 と object response の message を維持する', () => {
    const { res, status, json } = createResponse()
    const filter = new GlobalExceptionFilter(mockAppConfig)

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

  describe('Character exceptions', () => {
    const developmentConfig = {
      get: (path: string) => (path === 'app.environment' ? 'development' : undefined)
    } as unknown as AppConfigService

    it('CharacterAuthenticationException は旧 401 wire とバイト等価なフィールドを返す', () => {
      const { res, status, json } = createResponse()
      const filter = new GlobalExceptionFilter(developmentConfig)

      filter.catch(new CharacterAuthenticationException('ログインが必要です'), createHost(res))

      expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED)
      expect(JSON.parse(JSON.stringify(json.mock.calls[0][0]))).toEqual({
        success: false,
        message: '認証エラー',
        timestamp: expect.any(Number),
        requestId: expect.any(String),
        error: 'ログインが必要です',
        errorCode: 'AUTHENTICATION_ERROR'
      })
      expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('"stack"')
    })

    it('CharacterNotFoundException は旧 404 wire とバイト等価なフィールドを返す', () => {
      const { res, status, json } = createResponse()
      const filter = new GlobalExceptionFilter(developmentConfig)

      filter.catch(new CharacterNotFoundException('キャラクター'), createHost(res))

      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
      expect(JSON.parse(JSON.stringify(json.mock.calls[0][0]))).toEqual({
        success: false,
        message: '未発見エラー',
        timestamp: expect.any(Number),
        requestId: expect.any(String),
        error: 'キャラクターが見つかりません',
        errorCode: 'NOT_FOUND_ERROR'
      })
      expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('"stack"')
    })
  })
})
