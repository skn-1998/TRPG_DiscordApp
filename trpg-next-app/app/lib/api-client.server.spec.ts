jest.mock('server-only', () => ({}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

jest.mock('../config/env.server', () => ({
  getServerDomain: jest.fn(() => 'http://localhost:3000'),
  isProduction: jest.fn(() => false)
}))

jest.mock('axios', () => {
  const actualAxios = jest.requireActual<typeof import('axios')>('axios')
  return {
    __esModule: true,
    ...actualAxios,
    default: {
      ...actualAxios.default,
      create: jest.fn()
    }
  }
})

import axios, { AxiosHeaders } from 'axios'
import type { AxiosRequestConfig, RawAxiosHeaders } from 'axios'
import { cookies } from 'next/headers'
import { apiClient } from './api-client.server'

const mockedCookies = jest.mocked(cookies)
const mockedAxiosCreate = jest.mocked(axios.create)
const mockedGet = jest.fn().mockResolvedValue({ data: {} })
const mockedAxiosInstance = { get: mockedGet }

function mockJwtCookie(jwt?: string): jest.Mock {
  const get = jest.fn(() => (jwt ? { name: 'jwt', value: jwt } : undefined))
  mockedCookies.mockResolvedValue({ get } as never)
  return get
}

function requestConfig(): AxiosRequestConfig {
  return mockedGet.mock.calls[0][1] as AxiosRequestConfig
}

function requestHeaders(): AxiosHeaders {
  return AxiosHeaders.from(requestConfig().headers as RawAxiosHeaders | AxiosHeaders | undefined)
}

beforeEach(() => {
  mockedAxiosCreate.mockReturnValue(mockedAxiosInstance as never)
})

describe('apiClient Authorization', () => {
  it('cookie に jwt があれば Bearer Authorization を付ける', async () => {
    const getCookie = mockJwtCookie('cookie-token')

    await apiClient.get('/users')

    expect(getCookie).toHaveBeenCalledWith('jwt')
    expect(requestHeaders().get('Authorization')).toBe('Bearer cookie-token')
  })

  it('cookie に jwt がなければ Authorization を付けない', async () => {
    mockJwtCookie()

    await apiClient.get('/users')

    expect(requestHeaders().has('Authorization')).toBe(false)
  })

  it('呼び出し側の Authorization を上書きしない', async () => {
    mockJwtCookie('cookie-token')

    await apiClient.get('/users', {
      headers: { Authorization: 'Basic existing-authorization' }
    })

    expect(requestHeaders().get('Authorization')).toBe('Basic existing-authorization')
  })
})
