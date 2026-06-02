import { Test } from '@nestjs/testing'
import { HttpService } from '@nestjs/axios'
import { of } from 'rxjs'
import type { AxiosResponse, AxiosRequestConfig } from 'axios'
import { HttpClientService } from './http.service'

/**
 * HttpClientService は @nestjs/axios の HttpService への薄いラッパ。
 * 副作用の境界は HttpService（HTTP I/O）のみ。これを useValue でモックし、
 * 各メソッドが「同じ引数で委譲し、戻り値（Observable）をそのまま返す」ことを検証する。
 */
describe('HttpClientService', () => {
  let httpService: jest.Mocked<Pick<HttpService, 'get' | 'post'>>
  let service: HttpClientService

  beforeEach(async () => {
    httpService = { get: jest.fn(), post: jest.fn() }

    const moduleRef = await Test.createTestingModule({
      providers: [HttpClientService, { provide: HttpService, useValue: httpService }]
    }).compile()

    service = moduleRef.get(HttpClientService)
  })

  describe('get', () => {
    it('url と config を HttpService.get に委譲し、その Observable をそのまま返す', () => {
      // Arrange
      const response = { data: { ok: true } } as AxiosResponse<{ ok: boolean }>
      const expected = of(response)
      httpService.get.mockReturnValue(expected)
      const config: AxiosRequestConfig = { headers: { Authorization: 'Bearer token' } }

      // Act
      const result = service.get<{ ok: boolean }>('https://example.com/api', config)

      // Assert
      expect(result).toBe(expected)
      expect(httpService.get).toHaveBeenCalledWith('https://example.com/api', config)
      expect(httpService.get).toHaveBeenCalledTimes(1)
    })

    it('config 省略時は undefined を渡して委譲する', () => {
      const expected = of({} as AxiosResponse)
      httpService.get.mockReturnValue(expected)

      const result = service.get('https://example.com/api')

      expect(result).toBe(expected)
      expect(httpService.get).toHaveBeenCalledWith('https://example.com/api', undefined)
    })
  })

  describe('post', () => {
    it('url・data・config を HttpService.post に委譲し、その Observable をそのまま返す', () => {
      // Arrange
      const response = { data: { id: 'x1' } } as AxiosResponse<{ id: string }>
      const expected = of(response)
      httpService.post.mockReturnValue(expected)
      const body = { name: 'foo' }
      const config: AxiosRequestConfig = { headers: { 'Content-Type': 'application/json' } }

      // Act
      const result = service.post<{ id: string }>('https://example.com/api', body, config)

      // Assert
      expect(result).toBe(expected)
      expect(httpService.post).toHaveBeenCalledWith('https://example.com/api', body, config)
      expect(httpService.post).toHaveBeenCalledTimes(1)
    })

    it('data・config 省略時は undefined を渡して委譲する', () => {
      const expected = of({} as AxiosResponse)
      httpService.post.mockReturnValue(expected)

      const result = service.post('https://example.com/api')

      expect(result).toBe(expected)
      expect(httpService.post).toHaveBeenCalledWith('https://example.com/api', undefined, undefined)
    })
  })
})
