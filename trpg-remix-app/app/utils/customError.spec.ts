import { CustomError } from './customError'

describe('CustomError', () => {
  it('AxiosError の ErrorEnvelope は HTTP status と error 詳細を返す', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          message: 'Bad Request',
          error: '入力内容が不正です'
        }
      }
    }

    const result = CustomError(error)

    expect(result).toBe('HTTP 400: 入力内容が不正です')
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
