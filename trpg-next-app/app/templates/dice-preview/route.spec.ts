jest.mock('server-only', () => ({}))

jest.mock('../../lib/auth-guard.server', () => ({
  readJwt: jest.fn()
}))

jest.mock('../../lib/api-client.server', () => ({
  apiClient: {
    post: jest.fn()
  }
}))

import type { ErrorEnvelope } from '@trpg/api-contract'
import { apiClient } from '../../lib/api-client.server'
import { readJwt } from '../../lib/auth-guard.server'
import {
  DICE_PREVIEW_INVALID_RESPONSE_CODE,
  DICE_PREVIEW_NETWORK_ERROR_CODE
} from '../../features/characterTemplate/utils/dicePreview'
import { POST } from './route'

const mockedReadJwt = jest.mocked(readJwt)
const mockedApiPost = jest.mocked(apiClient.post)

beforeEach(() => {
  mockedReadJwt.mockResolvedValue('jwt-token')
})

describe('POST /templates/dice-preview', () => {
  it('未認証なら HTTP 401 の JSON エラーを返す', async () => {
    mockedReadJwt.mockResolvedValue(undefined)

    const response = await POST(createJsonRequest({ notation: '2d6' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ status: 401, messages: ['認証が必要です'] })
    expect(mockedApiPost).not.toHaveBeenCalled()
  })

  it('notation が欠けた body なら HTTP 400 で zod issue messages を返す', async () => {
    const response = await POST(createJsonRequest({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      status: 400,
      messages: ['Invalid input: expected string, received undefined']
    })
    expect(mockedApiPost).not.toHaveBeenCalled()
  })

  it('上流成功なら parse 済み結果を HTTP 200 で返す', async () => {
    const previewResult = { total: 9, details: '(2D6) ＞ 9[4,5]' }
    mockedApiPost.mockResolvedValue({ data: previewResult } as never)

    const response = await POST(createJsonRequest({ notation: '2d6', gameSystemId: 'Cthulhu7th' }))

    expect(mockedApiPost).toHaveBeenCalledWith('/dice-roll/preview', {
      notation: '2d6',
      gameSystemId: 'Cthulhu7th'
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(previewResult)
  })

  it('上流応答形が不正なら HTTP 502 と invalid-response code を返す', async () => {
    mockedApiPost.mockResolvedValue({ data: { total: 9 } } as never)

    const response = await POST(createJsonRequest({ notation: '2d6' }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      status: 502,
      messages: ['ダイスロールサーバーの応答形式が不正です'],
      errorCode: DICE_PREVIEW_INVALID_RESPONSE_CODE
    })
  })

  it('上流 ErrorEnvelope なら HTTP status と messages と errorCode を転送する', async () => {
    const upstreamError: ErrorEnvelope = {
      success: false,
      message: 'Request failed',
      timestamp: 1,
      error: 'Too Many Requests',
      errorCode: 'DICE_PREVIEW_RATE_LIMITED',
      issues: [{ message: 'dice preview rate limit exceeded' }]
    }
    mockedApiPost.mockRejectedValue({ response: { status: 429, data: upstreamError } })

    const response = await POST(createJsonRequest({ notation: '2d6' }))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      status: 429,
      messages: ['dice preview rate limit exceeded'],
      errorCode: 'DICE_PREVIEW_RATE_LIMITED'
    })
  })

  it('上流へ接続できなければ HTTP 502 と network-error code を返す', async () => {
    mockedApiPost.mockRejectedValue(new Error('network unavailable'))

    const response = await POST(createJsonRequest({ notation: '2d6' }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      status: 502,
      messages: ['ダイスロールサーバーに接続できませんでした'],
      errorCode: DICE_PREVIEW_NETWORK_ERROR_CODE
    })
  })
})

function createJsonRequest(body: unknown): Request {
  return new Request('http://localhost:3100/templates/dice-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}
