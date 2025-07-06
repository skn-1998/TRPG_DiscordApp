import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { of } from 'rxjs'

// 認証モック用のテストデータ
export const mockAuthData = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  tokenType: 'Bearer',
  scope: 'identify email guilds',

  discordUser: {
    id: '123456789',
    username: 'TestUser',
    discriminator: '0001',
    avatar: 'test-avatar-hash',
    email: 'test@example.com'
  },

  jwtPayload: {
    sub: '123456789',
    username: 'TestUser',
    discordId: '123456789',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  }
}

// JWT Service モック
export const mockJwtService = {
  sign: jest.fn((payload: Record<string, unknown>) => 'mock-jwt-token'),
  verify: jest.fn((token: string) => mockAuthData.jwtPayload),
  decode: jest.fn((token: string) => mockAuthData.jwtPayload)
}

// Config Service モック
export const mockConfigService = {
  get: jest.fn((key: string) => {
    const config = {
      'auth.jwt.secret': 'test-jwt-secret',
      'auth.jwt.expiresIn': '1h',
      'auth.discord.clientId': 'test-client-id',
      'auth.discord.clientSecret': 'test-client-secret',
      'auth.discord.redirectUri': 'http://localhost:3000/auth/discord/callback'
    }
    return config[key]
  })
}

// HTTP Service モック (Discord API用)
export const mockHttpService = {
  get: jest.fn(() =>
    of({
      data: mockAuthData.discordUser,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    })
  ),
  post: jest.fn(() =>
    of({
      data: {
        access_token: mockAuthData.accessToken,
        refresh_token: mockAuthData.refreshToken,
        expires_in: mockAuthData.expiresIn,
        token_type: mockAuthData.tokenType,
        scope: mockAuthData.scope
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    })
  )
}

// 認証ガード モック
export const mockAuthGuard = {
  canActivate: jest.fn(() => true)
}

// パスポート戦略 モック
export const mockDiscordStrategy = {
  validate: jest.fn((accessToken: string, refreshToken: string, profile: Record<string, unknown>) => {
    return Promise.resolve(mockAuthData.discordUser)
  })
}

// Request モック (Express Request with User)
export const createMockRequest = (user = mockAuthData.discordUser) => ({
  user,
  headers: {
    authorization: `Bearer ${mockAuthData.accessToken}`
  },
  cookies: {},
  session: {}
})

// Response モック (Express Response)
export const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis()
  }
  return res
}

// 認証エラー用のモック
export const mockAuthErrors = {
  unauthorized: {
    response: {
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized'
    }
  },
  forbidden: {
    response: {
      statusCode: 403,
      message: 'Forbidden',
      error: 'Forbidden'
    }
  },
  badRequest: {
    response: {
      statusCode: 400,
      message: 'Bad Request',
      error: 'Bad Request'
    }
  }
}

// 認証プロバイダー用のモック配列
export const mockAuthProviders = [
  { provide: JwtService, useValue: mockJwtService },
  { provide: ConfigService, useValue: mockConfigService },
  { provide: HttpService, useValue: mockHttpService }
]
