import type { ErrorEnvelope } from '@trpg/api-contract'

import { CustomError } from './customError'

describe('CustomError', () => {
  it('AxiosError の ErrorEnvelope は issues の全診断をスラッシュ区切りで返す', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          message: 'Bad Request',
          timestamp: 1,
          requestId: 'request-issues',
          error: '入力内容が不正です',
          issues: [{ message: '名前は必須です' }, { message: 'タグが不正です' }],
          cause: { message: ['旧 body の診断です'] },
          details: [{ message: '詳細診断です' }]
        } satisfies ErrorEnvelope
      }
    }

    const result = CustomError(error)

    expect(result).toBe('HTTP 400: 名前は必須です / タグが不正です')
  })

  it('AxiosError の ErrorEnvelope は issues が空なら cause.message の全診断を返す', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          message: 'Bad Request',
          timestamp: 1,
          requestId: 'request-cause',
          error: '入力内容が不正です',
          issues: [],
          cause: { message: ['名前は必須です', 'タグが不正です'] },
          details: [{ message: '詳細診断です' }]
        } satisfies ErrorEnvelope
      }
    }

    const result = CustomError(error)

    expect(result).toBe('HTTP 400: 名前は必須です / タグが不正です')
  })

  it('AxiosError の ErrorEnvelope は details の複数診断をスラッシュ区切りで返す', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          message: 'Bad Request',
          timestamp: 1,
          requestId: 'request-details-multiple',
          error: 'a, b',
          issues: [],
          cause: { message: [] },
          details: [{ message: 'a' }, { message: 'b' }]
        } satisfies ErrorEnvelope
      }
    }

    const result = CustomError(error)

    expect(result).toBe('HTTP 400: a / b')
  })

  it('AxiosError の ErrorEnvelope は details の単一診断を従来どおり返す', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          message: 'Bad Request',
          timestamp: 1,
          requestId: 'request-details-single',
          error: 'a',
          details: [{ message: 'a' }]
        } satisfies ErrorEnvelope
      }
    }

    const result = CustomError(error)

    expect(result).toBe('HTTP 400: a')
  })

  it('AxiosError の ErrorEnvelope は構造化診断が空なら error 詳細を返す', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          message: 'Bad Request',
          timestamp: 1,
          requestId: 'request-error',
          error: '入力内容が不正です',
          issues: [],
          cause: { message: [] },
          details: []
        } satisfies ErrorEnvelope
      }
    }

    const result = CustomError(error)

    expect(result).toBe('HTTP 400: 入力内容が不正です')
  })

  it('AxiosError の ErrorEnvelope は構造化診断と error が空なら message を返す', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          message: 'Bad Request',
          timestamp: 1,
          requestId: 'request-message',
          error: '',
          issues: [],
          cause: { message: [] },
          details: []
        } satisfies ErrorEnvelope
      }
    }

    const result = CustomError(error)

    expect(result).toBe('HTTP 400: Bad Request')
  })

  it('AxiosError の非 envelope は data.message を従来どおり返す', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: { message: '入力内容が不正です' }
      }
    }

    const result = CustomError(error)

    expect(result).toBe('HTTP 400: 入力内容が不正です')
  })

  it('AxiosError の非 envelope は data.message がなければ statusText を従来どおり返す', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 503,
        statusText: 'Service Unavailable'
      }
    }

    const result = CustomError(error)

    expect(result).toBe('HTTP 503: Service Unavailable')
  })

  it('通常の Error は message を返す', () => {
    const error = new Error('処理に失敗しました')

    const result = CustomError(error)

    expect(result).toBe('処理に失敗しました')
  })

  it('status のない response を持つ非 Axios Error は message を返す', () => {
    const error = Object.assign(new Error('通常エラーです'), {
      response: {}
    })

    const result = CustomError(error)

    expect(result).toBe('通常エラーです')
  })

  it('null と数値は Unknown Error を返す', () => {
    const nullResult = CustomError(null)
    const numberResult = CustomError(42)

    expect(nullResult).toBe('Unknown Error')
    expect(numberResult).toBe('Unknown Error')
  })

  it('message を持つオブジェクトは message を返す', () => {
    const error = {
      message: 'オブジェクトエラーです'
    }

    const result = CustomError(error)

    expect(result).toBe('オブジェクトエラーです')
  })
})
