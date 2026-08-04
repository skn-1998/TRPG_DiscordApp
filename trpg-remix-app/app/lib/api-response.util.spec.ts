import { ApiResponseUtil, getResponseStatus } from './api-response.util'

describe('getResponseStatus', () => {
  it('response.status が number なら返す', () => {
    expect(getResponseStatus({ response: { status: 409 } })).toBe(409)
  })

  it('response.status が string なら undefined を返す', () => {
    expect(getResponseStatus({ response: { status: '409' } })).toBeUndefined()
  })

  it('response.status が欠落していれば undefined を返す', () => {
    expect(getResponseStatus({ response: {} })).toBeUndefined()
  })

  it('response が欠落していれば undefined を返す', () => {
    expect(getResponseStatus({})).toBeUndefined()
  })

  it('null または非 object なら undefined を返す', () => {
    expect(getResponseStatus(null)).toBeUndefined()
    expect(getResponseStatus('error')).toBeUndefined()
  })
})

describe('ApiResponseUtil.handleError', () => {
  it('ErrorEnvelope は issues を優先して重複除去し、複数件をスラッシュ区切りにする', () => {
    const error = {
      response: {
        data: {
          success: false,
          message: 'Bad Request',
          error: '入力内容が不正です',
          issues: [{ message: '名前は必須です' }, { message: '名前は必須です' }, { message: 'タグが不正です' }],
          cause: { message: ['旧 body の診断です'] },
          details: [{ message: '詳細診断です' }]
        }
      }
    }

    const result = ApiResponseUtil.handleError(error)

    expect(result).toBe('名前は必須です / タグが不正です')
  })

  it('ErrorEnvelope は issues が空なら cause.message の文字列配列を優先する', () => {
    const error = {
      response: {
        data: {
          success: false,
          message: 'Bad Request',
          error: '入力内容が不正です',
          issues: [],
          cause: { message: ['名前は必須です', 'タグが不正です'] },
          details: [{ message: '詳細診断です' }]
        }
      }
    }

    const result = ApiResponseUtil.handleError(error)

    expect(result).toBe('名前は必須です / タグが不正です')
  })

  it('ErrorEnvelope は issues・cause.message が空なら details を優先する', () => {
    const error = {
      response: {
        data: {
          success: false,
          message: 'Bad Request',
          error: '入力内容が不正です',
          issues: [],
          cause: { message: [] },
          details: [{ message: '名前は必須です' }, { message: '名前は必須です' }]
        }
      }
    }

    const result = ApiResponseUtil.handleError(error)

    expect(result).toBe('名前は必須です')
  })

  it('ErrorEnvelope は構造化診断が空なら message より error を優先する', () => {
    const error = {
      response: {
        data: {
          success: false,
          message: 'Bad Request',
          error: '入力内容が不正です',
          issues: [],
          cause: { message: [] },
          details: []
        }
      }
    }

    const result = ApiResponseUtil.handleError(error)

    expect(result).toBe('入力内容が不正です')
  })

  it('ErrorEnvelope は構造化診断と error が空なら最後に message を返す', () => {
    const error = {
      response: {
        data: {
          success: false,
          message: 'Bad Request',
          error: '',
          issues: [],
          cause: { message: [] },
          details: []
        }
      }
    }

    const result = ApiResponseUtil.handleError(error)

    expect(result).toBe('Bad Request')
  })

  it('Nest 既定エラー形は message を優先する', () => {
    const error = {
      response: {
        data: {
          statusCode: 404,
          message: 'Cannot GET /missing',
          error: 'Not Found'
        }
      }
    }

    const result = ApiResponseUtil.handleError(error)

    expect(result).toBe('Cannot GET /missing')
  })

  it('ValidationPipe の message 配列はカンマ区切りで連結する', () => {
    const error = {
      response: {
        data: {
          statusCode: 400,
          message: ['a', 'b'],
          error: 'Bad Request'
        }
      }
    }

    const result = ApiResponseUtil.handleError(error)

    expect(result).toBe('a, b')
  })

  it('message も error もないレスポンスは fallback を返す', () => {
    const error = {
      response: {
        data: {
          statusCode: 500
        }
      }
    }

    const result = ApiResponseUtil.handleError(error)

    expect(result).toBe('Unknown error occurred')
  })

  it('response がない場合は Error の message または Network fallback を返す', () => {
    const error = new Error('接続に失敗しました')
    const unknownError = {}

    const errorMessage = ApiResponseUtil.handleError(error)
    const fallbackMessage = ApiResponseUtil.handleError(unknownError)

    expect(errorMessage).toBe('接続に失敗しました')
    expect(fallbackMessage).toBe('Network error occurred')
  })
})
