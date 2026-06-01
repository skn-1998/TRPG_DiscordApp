import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException, HttpException } from '@nestjs/common'
import { JwtTokenService } from './jwt-token.service'
import { JwtTokenPayload } from '../models/auth.token.model'

/**
 * JwtTokenService の単体テスト。
 *
 * H6 で AuthService.validateToken / parseJwt から切り出した JWT 検証プリミティブの
 * 挙動（有効/無効トークンの検証・例外・戻り値）を固定する。
 */
describe('JwtTokenService', () => {
  let service: JwtTokenService
  let jwtService: jest.Mocked<JwtService>

  const mockJwtPayload: JwtTokenPayload = {
    username: 'Test User',
    discordUserId: 'test-discord-id'
  }

  beforeEach(async () => {
    const jwtServiceMock = {
      sign: jest.fn(),
      verify: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtTokenService,
        {
          provide: JwtService,
          useValue: jwtServiceMock
        }
      ]
    }).compile()

    service = module.get<JwtTokenService>(JwtTokenService)
    jwtService = module.get(JwtService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('validateToken', () => {
    it('should validate valid Bearer token and return payload', async () => {
      const mockToken = 'valid-jwt-token'
      jwtService.verify.mockReturnValue(mockJwtPayload)

      const result = await service.validateToken(`Bearer ${mockToken}`)

      expect(result).toEqual(mockJwtPayload)
      expect(jwtService.verify).toHaveBeenCalledWith(mockToken)
    })

    it('should throw UnauthorizedException for missing authorization header', async () => {
      await expect(service.validateToken('')).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException for header without Bearer prefix', async () => {
      await expect(service.validateToken('InvalidToken')).rejects.toThrow(UnauthorizedException)
    })

    it('should throw HttpException for invalid JWT token', async () => {
      const mockToken = 'invalid-jwt-token'
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      await expect(service.validateToken(`Bearer ${mockToken}`)).rejects.toThrow(HttpException)
    })
  })

  describe('parseJwt', () => {
    it('should parse valid JWT token and return payload', async () => {
      const mockToken = 'valid-jwt-token'
      jwtService.verify.mockReturnValue(mockJwtPayload)

      const result = await service.parseJwt(mockToken)

      expect(result).toEqual(mockJwtPayload)
      expect(jwtService.verify).toHaveBeenCalledWith(mockToken)
    })

    it('should throw HttpException for invalid JWT token', async () => {
      const mockToken = 'invalid-jwt-token'
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      await expect(service.parseJwt(mockToken)).rejects.toThrow(HttpException)
    })
  })
})
