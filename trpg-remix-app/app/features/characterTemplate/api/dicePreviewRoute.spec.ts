import type { ActionFunctionArgs } from '@remix-run/node'
import { getJwtFromRequest } from '~/features/auth/api/auth.service'
import { apiClient, clearServerRequestContext, setServerRequestContext, withJwt } from '~/lib/api-client'
import { action } from '../../../routes/templates.dice-preview'

jest.mock(
  '~/features/auth/api/auth.service',
  () => ({
    getJwtFromRequest: jest.fn()
  }),
  { virtual: true }
)

jest.mock('~/features/characterTemplate/utils/dicePreview', () => jest.requireActual('../utils/dicePreview'), {
  virtual: true
})

jest.mock(
  '~/lib/api-client',
  () => ({
    apiClient: { post: jest.fn() },
    clearServerRequestContext: jest.fn(),
    setServerRequestContext: jest.fn(),
    withJwt: jest.fn((jwt: string) => ({ jwt }))
  }),
  { virtual: true }
)

const mockedGetJwtFromRequest = jest.mocked(getJwtFromRequest)
const mockedPost = jest.mocked(apiClient.post)
const mockedClearServerRequestContext = jest.mocked(clearServerRequestContext)
const mockedSetServerRequestContext = jest.mocked(setServerRequestContext)
const mockedWithJwt = jest.mocked(withJwt)

describe('templates.dice-preview action', () => {
  beforeEach(() => {
    mockedGetJwtFromRequest.mockReturnValue('jwt-token')
  })

  it('JWT が無い場合は server を呼ばず 401 JSON を返す', async () => {
    mockedGetJwtFromRequest.mockReturnValue(null)

    const response = await invokeAction({ notation: '1d6' })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      statusCode: 401,
      message: '認証が必要です',
      error: 'Unauthorized'
    })
    expect(mockedPost).not.toHaveBeenCalled()
    expect(mockedSetServerRequestContext).not.toHaveBeenCalled()
  })

  it('contract に合わない body は 400 にし、request context を解除する', async () => {
    const response = await invokeAction({ notation: '', unexpected: true })

    expect(response.status).toBe(400)
    expect(mockedPost).not.toHaveBeenCalled()
    expect(mockedSetServerRequestContext).toHaveBeenCalledWith(expect.any(Request), 'jwt-token')
    expect(mockedClearServerRequestContext).toHaveBeenCalledTimes(1)
  })

  it('補間済み request を明示 JWT で転送し、contract response を返す', async () => {
    mockedPost.mockResolvedValue({
      data: { total: 7, details: '(2D6) ＞ 7[3,4]' },
      status: 200,
      statusText: 'OK'
    })

    const response = await invokeAction({ notation: '2d6', gameSystemId: 'DiceBot' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ total: 7, details: '(2D6) ＞ 7[3,4]' })
    expect(mockedWithJwt).toHaveBeenCalledWith('jwt-token')
    expect(mockedPost).toHaveBeenCalledWith(
      '/dice-roll/preview',
      { notation: '2d6', gameSystemId: 'DiceBot' },
      { jwt: 'jwt-token' }
    )
    expect(mockedClearServerRequestContext).toHaveBeenCalledTimes(1)
  })

  it.each([400, 422, 429])('server の %i body と status をそのまま返す', async (status) => {
    const upstreamBody = { statusCode: status, message: [`upstream ${status}`], error: 'Upstream Error' }
    mockedPost.mockRejectedValue({ response: { status, data: upstreamBody } })

    const response = await invokeAction({ notation: '10' })

    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual(upstreamBody)
    expect(mockedClearServerRequestContext).toHaveBeenCalledTimes(1)
  })

  it('server に接続できない場合は network 固有 code の 502 を返す', async () => {
    mockedPost.mockRejectedValue(new Error('ECONNREFUSED'))

    const response = await invokeAction({ notation: '1d6' })

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      statusCode: 502,
      message: 'ダイスロールサーバーに接続できませんでした',
      code: 'DICE_PREVIEW_NETWORK_ERROR'
    })
    expect(mockedClearServerRequestContext).toHaveBeenCalledTimes(1)
  })

  it('server の成功 body が contract に合わない場合は 502 を返す', async () => {
    mockedPost.mockResolvedValue({ data: { total: Number.NaN }, status: 200, statusText: 'OK' })

    const response = await invokeAction({ notation: '1d6' })

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      statusCode: 502,
      code: 'DICE_PREVIEW_INVALID_RESPONSE'
    })
    expect(mockedClearServerRequestContext).toHaveBeenCalledTimes(1)
  })
})

async function invokeAction(body: unknown): Promise<Response> {
  const request = new Request('http://localhost/templates/dice-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return action({ request, params: {}, context: {} } as ActionFunctionArgs)
}
