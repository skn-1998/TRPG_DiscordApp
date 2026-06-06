import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException, HttpException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtTokenService } from '../token/jwt-token.service'
import { UserService } from '../../user/user.service'
import { HttpClientService } from '../../../core/shared/services/http.service'
import { CryptoService } from '../../../core/shared/services/crypto.service'
import { AppConfigService } from '../../../config/config.service'
import { DiscordUserProfile } from '../models/discord-user.model'
import { User } from '../../user/models/user.model'
import { JwtTokenPayload } from '../models/auth.token.model'
import { of, throwError } from 'rxjs'

describe('AuthService', () => {
  let service: AuthService
  let jwtService: jest.Mocked<JwtService>
  let httpService: jest.Mocked<HttpClientService>
  let userService: jest.Mocked<UserService>
  let cryptoService: jest.Mocked<CryptoService>

  // テストデータ
  const mockUser: User = {
    discordUserId: 'test-discord-id',
    name: 'Test User',
    avatarHash: 'test-avatar-hash',
    characterIds: []
  }

  const mockDiscordProfile: DiscordUserProfile = {
    id: 'test-discord-id',
    username: 'TestUser',
    discriminator: '0001',
    avatar: 'test-avatar-hash',
    verified: true,
    email: 'test@example.com'
  }

  const mockJwtPayload: JwtTokenPayload = {
    username: 'Test User',
    discordUserId: 'test-discord-id'
  }

  beforeEach(async () => {
    // JwtService モック
    const jwtServiceMock = {
      sign: jest.fn(),
      verify: jest.fn()
    }

    // HttpClientService モック（RxJS Observable を返すように修正）
    const httpServiceMock = {
      post: jest.fn(),
      get: jest.fn()
    }

    // UserService モック
    const userServiceMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }

    // AppConfigService モック
    const configValues: Record<string, string> = {
      'app.frontendUrl': 'http://127.0.0.1:5173',
      'discord.applicationId': 'app-id',
      'discord.secret': 'secret'
    }
    const appConfigServiceMock = {
      get: jest.fn((key: string) => configValues[key])
    }

    // CryptoService モック
    const cryptoServiceMock = {
      encrypt: jest.fn(),
      decrypt: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        // JWT 検証プリミティブは JwtTokenService に集約済み。AuthService.validateToken /
        // parseJwt は委譲するだけなので、実体の JwtTokenService（同一の JwtService モックを使用）を
        // 登録して従来どおり jwtService.verify の呼び出しを検証する。
        JwtTokenService,
        {
          provide: JwtService,
          useValue: jwtServiceMock
        },
        {
          provide: HttpClientService,
          useValue: httpServiceMock
        },
        {
          provide: UserService,
          useValue: userServiceMock
        },
        {
          provide: AppConfigService,
          useValue: appConfigServiceMock
        },
        {
          provide: CryptoService,
          useValue: cryptoServiceMock
        }
      ]
    }).compile()

    service = module.get<AuthService>(AuthService)
    jwtService = module.get(JwtService)
    httpService = module.get(HttpClientService)
    userService = module.get(UserService)
    cryptoService = module.get(CryptoService)
  })

  describe('基本機能', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })
  })

  describe('validateDiscordUser', () => {
    it('should validate Discord user successfully', async () => {
      const result = await service.validateDiscordUser('access-token', 'refresh-token', mockDiscordProfile)

      expect(result).toEqual(mockDiscordProfile)
    })
  })

  describe('validateToken', () => {
    it('should validate valid Bearer token', async () => {
      const mockToken = 'valid-jwt-token'
      jwtService.verify.mockReturnValue(mockJwtPayload)

      const result = await service.validateToken(`Bearer ${mockToken}`)

      expect(result).toEqual(mockJwtPayload)
      expect(jwtService.verify).toHaveBeenCalledWith(mockToken)
    })

    it('should throw UnauthorizedException for missing authorization header', async () => {
      await expect(service.validateToken('')).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException for invalid authorization header', async () => {
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

  describe('generateJwt', () => {
    it('should generate JWT token successfully', async () => {
      const mockJwt = 'generated-jwt-token'
      jwtService.sign.mockReturnValue(mockJwt)

      const result = await service.generateJwt(mockUser)

      expect(result).toBe(mockJwt)
      expect(jwtService.sign).toHaveBeenCalledWith({
        username: mockUser.name,
        discordUserId: mockUser.discordUserId
      })
    })

    it('should throw error when user name is missing', async () => {
      const userWithoutName = { ...mockUser, name: undefined }

      await expect(service.generateJwt(userWithoutName as any)).rejects.toThrow(
        'ユーザー名とDiscordユーザーIDは必須です'
      )
    })

    it('should throw error when discordUserId is missing', async () => {
      const userWithoutDiscordId = { ...mockUser, discordUserId: undefined }

      await expect(service.generateJwt(userWithoutDiscordId as any)).rejects.toThrow(
        'ユーザー名とDiscordユーザーIDは必須です'
      )
    })
  })

  describe('parseJwt', () => {
    it('should parse JWT token successfully', async () => {
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

  describe('signInAndRegisterUserInfo', () => {
    it('should create new user when user does not exist', async () => {
      userService.findOne.mockResolvedValue(null)
      userService.create.mockResolvedValue(mockUser)

      await service.signInAndRegisterUserInfo(mockUser)

      expect(userService.findOne).toHaveBeenCalledWith(mockUser.discordUserId)
      expect(userService.create).toHaveBeenCalledWith({
        discordUserId: mockUser.discordUserId,
        name: mockUser.name,
        avatarHash: mockUser.avatarHash,
        characterIds: mockUser.characterIds
      })
    })

    it('should update existing user when user exists', async () => {
      userService.findOne.mockResolvedValue(mockUser)
      userService.update.mockResolvedValue(mockUser)

      await service.signInAndRegisterUserInfo(mockUser)

      expect(userService.findOne).toHaveBeenCalledWith(mockUser.discordUserId)
      expect(userService.update).toHaveBeenCalledWith(mockUser.discordUserId, {
        name: mockUser.name,
        avatarHash: mockUser.avatarHash
      })
    })

    it('should throw error when discordUserId is missing', async () => {
      const userWithoutDiscordId = { ...mockUser, discordUserId: undefined }

      await expect(service.signInAndRegisterUserInfo(userWithoutDiscordId as any)).rejects.toThrow(
        'DiscordユーザーIDが指定されていません'
      )
    })

    it('should handle user service errors', async () => {
      userService.findOne.mockRejectedValue(new Error('Database error'))

      await expect(service.signInAndRegisterUserInfo(mockUser)).rejects.toThrow()
    })
  })

  describe('signInAndRegisterUserInfoWithTokens', () => {
    const mockAuthResponse = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'identify'
    }

    it('should throw error when discordUserId is missing', async () => {
      const userWithoutDiscordId = { ...mockUser, discordUserId: undefined }

      await expect(
        service.signInAndRegisterUserInfoWithTokens(userWithoutDiscordId as any, mockAuthResponse)
      ).rejects.toThrow('DiscordユーザーIDが指定されていません')
    })

    it('should handle user service errors', async () => {
      userService.findOne.mockRejectedValue(new Error('Database error'))

      await expect(service.signInAndRegisterUserInfoWithTokens(mockUser, mockAuthResponse)).rejects.toThrow()
    })
  })

  describe('authenticate', () => {
    it('should authenticate with Discord successfully', async () => {
      const mockCode = 'auth-code'
      const mockAuthResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'identify'
      }

      httpService.post.mockReturnValue(of({ data: mockAuthResponse }) as any)

      const result = await service.authenticate(mockCode)

      expect(result).toEqual(mockAuthResponse)
    })

    it('should handle authentication errors', async () => {
      const mockCode = 'invalid-code'
      httpService.post.mockReturnValue(throwError(() => new Error('Auth failed')) as any)

      await expect(service.authenticate(mockCode)).rejects.toThrow()
    })
  })

  describe('getUserInfo', () => {
    it('should get user info successfully', async () => {
      const mockToken = 'access-token'
      httpService.get.mockReturnValue(of({ data: mockDiscordProfile }) as any)

      const result = await service.getUserInfo(mockToken)

      expect(result).toEqual(mockDiscordProfile)
    })

    it('should handle getUserInfo errors', async () => {
      const mockToken = 'invalid-token'
      httpService.get.mockReturnValue(throwError(() => new Error('Get user info failed')) as any)

      await expect(service.getUserInfo(mockToken)).rejects.toThrow()
    })
  })

  // NOTE: Discord Guild 取得機能（getDiscordGuildsWithToken / getUserDiscordGuilds）は
  // AuthService から UserService（src/domains/user/user.service.ts）へ移管済みのため、
  // 該当テストは削除した。Guild 関連のテストは UserService 側で扱う。

  describe('getValidDiscordAccessToken', () => {
    it('should throw error when user not found', async () => {
      const mockDiscordUserId = 'nonexistent-user'
      userService.findOne.mockResolvedValue(null)

      await expect(service.getValidDiscordAccessToken(mockDiscordUserId)).rejects.toThrow()
    })
  })
})
