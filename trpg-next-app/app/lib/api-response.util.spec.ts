import type { ErrorEnvelope } from '@trpg/api-contract'
import { errorEnvelopeMessages, getResponseStatus, isErrorEnvelope } from './api-response.util'

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
