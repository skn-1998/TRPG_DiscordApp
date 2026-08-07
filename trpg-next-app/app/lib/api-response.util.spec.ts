import type { ErrorEnvelope } from '@trpg/api-contract'
import {
  errorEnvelopeMessages,
  extractApiErrorMessages,
  getResponseStatus,
  getUpstreamResponse,
  isErrorEnvelope
} from './api-response.util'

const baseEnvelope: ErrorEnvelope = {
  success: false,
  message: 'Bad Request',
  timestamp: 1,
  error: '入力内容が不正です'
}

describe('isErrorEnvelope', () => {
  it('success=false かつ error が string なら最小形でも ErrorEnvelope と判定する', () => {
    expect(isErrorEnvelope({ success: false, error: 'Bad Request' })).toBe(true)
  })

  it.each([
    null,
    'error',
    {},
    { success: true, error: 'Bad Request' },
    { success: false },
    { success: false, error: ['Bad Request'] }
  ])('判定境界外の値 %p は ErrorEnvelope と判定しない', (value) => {
    expect(isErrorEnvelope(value)).toBe(false)
  })
})

describe('errorEnvelopeMessages', () => {
  it('issues を最優先し、空文字を除外して重複を除く', () => {
    expect(
      errorEnvelopeMessages({
        ...baseEnvelope,
        issues: [{ message: '名前は必須です' }, { message: '' }, { message: '名前は必須です' }],
        cause: { message: ['旧 body の診断です'] },
        details: [{ message: '詳細診断です' }]
      })
    ).toEqual(['名前は必須です'])
  })

  it('issues が空なら cause.message の文字列配列を優先する', () => {
    expect(
      errorEnvelopeMessages({
        ...baseEnvelope,
        issues: [],
        cause: { message: ['名前は必須です', '', 'タグが不正です'] },
        details: [{ message: '詳細診断です' }]
      })
    ).toEqual(['名前は必須です', 'タグが不正です'])
  })

  it('cause.message が文字列配列でなければ details を優先し、重複を除く', () => {
    expect(
      errorEnvelopeMessages({
        ...baseEnvelope,
        issues: [],
        cause: { message: ['診断です', 1] },
        details: [{ message: '詳細診断です' }, { message: '詳細診断です' }]
      })
    ).toEqual(['詳細診断です'])
  })

  it('構造化診断が空なら message より error を優先する', () => {
    expect(
      errorEnvelopeMessages({
        ...baseEnvelope,
        issues: [],
        cause: { message: [] },
        details: []
      })
    ).toEqual(['入力内容が不正です'])
  })

  it('構造化診断と error が空なら最後に message を返す', () => {
    expect(
      errorEnvelopeMessages({
        ...baseEnvelope,
        error: '',
        issues: [],
        cause: { message: [] },
        details: []
      })
    ).toEqual(['Bad Request'])
  })
})

describe('getResponseStatus', () => {
  it('response.status が number なら返す', () => {
    expect(getResponseStatus({ response: { status: 409 } })).toBe(409)
  })

  it('axios error でない入力や number でない status は undefined を返す', () => {
    expect(getResponseStatus({ response: { status: '409' } })).toBeUndefined()
    expect(getResponseStatus({ response: {} })).toBeUndefined()
    expect(getResponseStatus({})).toBeUndefined()
    expect(getResponseStatus(null)).toBeUndefined()
    expect(getResponseStatus('error')).toBeUndefined()
  })
})

describe('getUpstreamResponse', () => {
  it('number の status と定義済み data があれば構造化して返す', () => {
    expect(getUpstreamResponse({ response: { status: 429, data: null } })).toEqual({ status: 429, data: null })
  })

  it('status または data が欠けた応答と response を持たない値は null を返す', () => {
    expect(getUpstreamResponse({ response: { status: 400 } })).toBeNull()
    expect(getUpstreamResponse({ response: { status: '400', data: {} } })).toBeNull()
    expect(getUpstreamResponse({})).toBeNull()
    expect(getUpstreamResponse(null)).toBeNull()
  })
})

describe('extractApiErrorMessages', () => {
  it('ErrorEnvelope は共通復号の優先順位で issues を返す', () => {
    const error = {
      response: {
        status: 400,
        data: {
          success: false,
          message: 'エラーが発生しました',
          timestamp: 1,
          error: '入力内容が不正です',
          issues: [{ message: '名前は必須です' }]
        }
      }
    }

    expect(extractApiErrorMessages(error)).toEqual(['名前は必須です'])
  })

  it('legacy message 配列は各要素を文字列化して返す', () => {
    const error = { response: { status: 400, data: { message: ['名前は必須です', 42] } } }

    expect(extractApiErrorMessages(error)).toEqual(['名前は必須です', '42'])
  })

  it("legacy message 文字列は ';' で分割し、空白と空要素を除く", () => {
    const error = { response: { status: 400, data: { message: ' 名前は必須です ; ; タグが不正です ' } } }

    expect(extractApiErrorMessages(error)).toEqual(['名前は必須です', 'タグが不正です'])
  })

  it('Error インスタンスは message を返す', () => {
    expect(extractApiErrorMessages(new Error('接続に失敗しました'))).toEqual(['接続に失敗しました'])
  })

  it('unknown はフォールバック文言を返す', () => {
    expect(extractApiErrorMessages(Symbol('unknown'))).toEqual(['リクエストの処理中にエラーが発生しました'])
  })
})
