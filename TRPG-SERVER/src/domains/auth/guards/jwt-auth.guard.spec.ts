import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtAuthGuard } from './jwt-auth.guard'
import { JwtTokenService } from '../token/jwt-token.service'
import { JwtTokenPayload } from '../models/auth.token.model'

/**
 * JwtAuthGuard の単体テスト。
 *
 * Authorization ヘッダー / クッキー(jwt) からトークンを取得し、
 * JwtTokenService.validateToken で検証して request.user に載せる挙動を固定する。
 * JwtTokenService は副作用の境界としてモックし、ExecutionContext は
 * switchToHttp().getRequest() が返す request を最小限でモックする。
 */
describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard
  let jwtTokenService: jest.Mocked<Pick<JwtTokenService, 'validateToken'>>

  const mockPayload: JwtTokenPayload = {
    username: 'Test User',
    discordUserId: 'test-discord-id'
  }

  // request を受け取り、それを返す最小の ExecutionContext を作る
  const createContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request
      })
    }) as unknown as ExecutionContext

  beforeEach(async () => {
    const jwtTokenServiceMock = {
      validateToken: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtTokenService,
          useValue: jwtTokenServiceMock
        }
      ]
    }).compile()

    guard = module.get<JwtAuthGuard>(JwtAuthGuard)
    jwtTokenService = module.get(JwtTokenService)
  })

  it('should be defined', () => {
    expect(guard).toBeDefined()
  })

  describe('canActivate', () => {
    it('should validate Authorization header, set request.user and return true', async () => {
      // Arrange
      const request: Record<string, unknown> = {
        headers: { authorization: 'Bearer valid-token' }
      }
      jwtTokenService.validateToken.mockResolvedValue(mockPayload)

      // Act
      const result = await guard.canActivate(createContext(request))

      // Assert
      expect(result).toBe(true)
      expect(jwtTokenService.validateToken).toHaveBeenCalledWith('Bearer valid-token')
      expect(request.user).toEqual(mockPayload)
    })

    it('should fall back to cookie jwt when Authorization header is missing', async () => {
      // Arrange
      const request: Record<string, unknown> = {
        headers: {},
        cookies: { jwt: 'cookie-token' }
      }
      jwtTokenService.validateToken.mockResolvedValue(mockPayload)

      // Act
      const result = await guard.canActivate(createContext(request))

      // Assert: クッキー値は Bearer プレフィックスを付けて検証に渡される
      expect(result).toBe(true)
      expect(jwtTokenService.validateToken).toHaveBeenCalledWith('Bearer cookie-token')
      expect(request.user).toEqual(mockPayload)
    })

    it('should prefer Authorization header over cookie when both are present', async () => {
      // Arrange
      const request: Record<string, unknown> = {
        headers: { authorization: 'Bearer header-token' },
        cookies: { jwt: 'cookie-token' }
      }
      jwtTokenService.validateToken.mockResolvedValue(mockPayload)

      // Act
      await guard.canActivate(createContext(request))

      // Assert
      expect(jwtTokenService.validateToken).toHaveBeenCalledWith('Bearer header-token')
    })

    it('should throw UnauthorizedException when neither header nor cookie is present', async () => {
      // Arrange
      const request: Record<string, unknown> = { headers: {} }

      // Act & Assert
      await expect(guard.canActivate(createContext(request))).rejects.toThrow(UnauthorizedException)
      expect(jwtTokenService.validateToken).not.toHaveBeenCalled()
    })

    it('should throw UnauthorizedException when token validation fails', async () => {
      // Arrange
      const request: Record<string, unknown> = {
        headers: { authorization: 'Bearer invalid-token' }
      }
      jwtTokenService.validateToken.mockRejectedValue(new Error('invalid token'))

      // Act & Assert
      await expect(guard.canActivate(createContext(request))).rejects.toThrow(UnauthorizedException)
      expect(request.user).toBeUndefined()
    })
  })
})
