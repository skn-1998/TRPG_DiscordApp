import { ApiResponseUtil } from './api-response.util'

describe('ApiResponseUtil.handleError', () => {
  it('ErrorEnvelope は message より error を優先する', () => {
    const error = {
      response: {
        data: {
          success: false,
          message: 'Bad Request',
          error: '入力内容が不正です'
        }
      }
    }

    const result = ApiResponseUtil.handleError(error)

    expect(result).toBe('入力内容が不正です')
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
