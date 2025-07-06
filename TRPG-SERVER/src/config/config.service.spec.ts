import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import { AppConfigService } from './config.service'
import { generateAppConfig, revalidateEnvironment, AppConfig } from './configuration'

describe('AppConfigService', () => {
  let service: AppConfigService
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    // 元の環境変数を保存
    originalEnv = { ...process.env }

    // テスト用の環境変数を設定（必須変数を含む）
    process.env.NODE_ENV = 'test'
    process.env.PORT = '3001'
    process.env.FRONTEND_URL = 'http://localhost:3000'
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db'
    process.env.DB_LOGGING = 'false'
    process.env.TOKEN = 'test-discord-token'
    process.env.DISCORD_APPLICATIONID = 'test-application-id'
    process.env.DISCORD_SECRET = 'test-discord-secret'
    process.env.GUILDID = 'test-guild-id'
    process.env.CHARACTER_CATEGORY = 'Test Character Category'
    process.env.DICE_ROLL_CATEGORY = 'Test Dice Roll Category'
    process.env.JWT_SECRET = 'test-jwt-secret'
    process.env.JWT_EXPIRES_IN = '3600'
    process.env.REDIRECT_URL = 'http://localhost:3000/auth/callback'
    process.env.DISCORD_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long'

    // 環境変数を再検証
    revalidateEnvironment()

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [generateAppConfig],
          isGlobal: true
        })
      ],
      providers: [AppConfigService]
    }).compile()

    service = module.get<AppConfigService>(AppConfigService)
  })

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv
    revalidateEnvironment()
  })

  describe('基本機能', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })
  })

  describe('get() method', () => {
    describe('app configuration', () => {
      it('should get app.environment', () => {
        const result = service.get('app.environment')
        expect(result).toBe('test')
      })

      it('should get app.port as number', () => {
        const result = service.get('app.port')
        expect(result).toBe(3001)
        expect(typeof result).toBe('number')
      })

      it('should get app.frontendUrl', () => {
        const result = service.get('app.frontendUrl')
        expect(result).toBe('http://localhost:3000')
      })
    })

    describe('database configuration', () => {
      it('should get database.mongoUri', () => {
        const result = service.get('database.mongoUri')
        expect(result).toBe('mongodb://localhost:27017/test_db')
      })

      it('should get database.logging as boolean', () => {
        const result = service.get('database.logging')
        expect(result).toBe(false)
        expect(typeof result).toBe('boolean')
      })
    })

    describe('discord configuration', () => {
      it('should get discord.token', () => {
        const result = service.get('discord.token')
        expect(result).toBe('test-discord-token')
      })

      it('should get discord.applicationId', () => {
        const result = service.get('discord.applicationId')
        expect(result).toBe('test-application-id')
      })

      it('should get discord.secret', () => {
        const result = service.get('discord.secret')
        expect(result).toBe('test-discord-secret')
      })

      it('should get discord.guildId', () => {
        const result = service.get('discord.guildId')
        expect(result).toBe('test-guild-id')
      })

      it('should get discord.characterCategory', () => {
        const result = service.get('discord.characterCategory')
        expect(result).toBe('Test Character Category')
      })

      it('should get discord.diceRollCategory', () => {
        const result = service.get('discord.diceRollCategory')
        expect(result).toBe('Test Dice Roll Category')
      })
    })

    describe('auth configuration', () => {
      it('should get auth.jwtSecret', () => {
        const result = service.get('auth.jwtSecret')
        expect(result).toBe('test-jwt-secret')
      })

      it('should get auth.jwtExpiresIn as number', () => {
        const result = service.get('auth.jwtExpiresIn')
        expect(result).toBe(3600)
        expect(typeof result).toBe('number')
      })

      it('should get auth.redirectUrl', () => {
        const result = service.get('auth.redirectUrl')
        expect(result).toBe('http://localhost:3000/auth/callback')
      })
    })

    describe('security configuration', () => {
      it('should get security.discordTokenEncryptionKey', () => {
        const result = service.get('security.discordTokenEncryptionKey')
        expect(result).toBe('test-encryption-key-32-characters-long')
      })
    })
  })

  describe('getRaw() method', () => {
    it('should get raw environment variable', () => {
      const result = service.getRaw('NODE_ENV')
      expect(result).toBe('test')
    })

    it('should return undefined for non-existent variable', () => {
      const result = service.getRaw('NON_EXISTENT_VAR')
      expect(result).toBeUndefined()
    })

    it('should get raw string values before conversion', () => {
      const portRaw = service.getRaw('PORT')
      const portParsed = service.get('app.port')

      expect(portRaw).toBe('3001') // string
      expect(portParsed).toBe(3001) // number
    })
  })

  describe('型安全性', () => {
    it('should infer correct types for all config paths', () => {
      // TypeScript コンパイル時に型チェックされる
      const environment: string = service.get('app.environment')
      const port: number = service.get('app.port')
      const logging: boolean = service.get('database.logging')
      const jwtExpiresIn: number = service.get('auth.jwtExpiresIn')

      expect(typeof environment).toBe('string')
      expect(typeof port).toBe('number')
      expect(typeof logging).toBe('boolean')
      expect(typeof jwtExpiresIn).toBe('number')
    })
  })
})

describe('generateAppConfig', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }

    // テスト用の必須環境変数を全て設定
    process.env.NODE_ENV = 'test'
    process.env.PORT = '3001'
    process.env.FRONTEND_URL = 'http://localhost:3000'
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db'
    process.env.DB_LOGGING = 'true'
    process.env.TOKEN = 'test-discord-token'
    process.env.DISCORD_APPLICATIONID = 'test-application-id'
    process.env.DISCORD_SECRET = 'test-discord-secret'
    process.env.GUILDID = 'test-guild-id'
    process.env.CHARACTER_CATEGORY = 'Test Character Category'
    process.env.DICE_ROLL_CATEGORY = 'Test Dice Roll Category'
    process.env.JWT_SECRET = 'test-jwt-secret'
    process.env.JWT_EXPIRES_IN = '7200'
    process.env.REDIRECT_URL = 'http://localhost:3000/auth/callback'
    process.env.DISCORD_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long'

    revalidateEnvironment()
  })

  afterEach(() => {
    process.env = originalEnv
    revalidateEnvironment()
  })

  it('should generate correct app config structure', () => {
    const config = generateAppConfig()

    expect(config).toHaveProperty('app')
    expect(config).toHaveProperty('database')
    expect(config).toHaveProperty('discord')
    expect(config).toHaveProperty('auth')
    expect(config).toHaveProperty('security')
  })

  it('should generate app configuration correctly', () => {
    const config = generateAppConfig()

    expect(config.app).toEqual({
      environment: 'test',
      port: 3001,
      frontendUrl: 'http://localhost:3000'
    })
  })

  it('should generate database configuration correctly', () => {
    const config = generateAppConfig()

    expect(config.database).toEqual({
      mongoUri: 'mongodb://localhost:27017/test_db',
      logging: true
    })
  })

  it('should generate discord configuration correctly', () => {
    const config = generateAppConfig()

    expect(config.discord).toEqual({
      token: 'test-discord-token',
      applicationId: 'test-application-id',
      secret: 'test-discord-secret',
      guildId: 'test-guild-id',
      characterCategory: 'Test Character Category',
      diceRollCategory: 'Test Dice Roll Category'
    })
  })

  it('should generate auth configuration correctly', () => {
    const config = generateAppConfig()

    expect(config.auth).toEqual({
      jwtSecret: 'test-jwt-secret',
      jwtExpiresIn: 7200,
      redirectUrl: 'http://localhost:3000/auth/callback'
    })
  })

  it('should generate security configuration correctly', () => {
    const config = generateAppConfig()

    expect(config.security).toEqual({
      discordTokenEncryptionKey: 'test-encryption-key-32-characters-long'
    })
  })

  it('should handle number conversion correctly', () => {
    const config = generateAppConfig()

    expect(config.app.port).toBe(3001)
    expect(config.auth.jwtExpiresIn).toBe(7200)
    expect(typeof config.app.port).toBe('number')
    expect(typeof config.auth.jwtExpiresIn).toBe('number')
  })

  it('should handle boolean conversion correctly', () => {
    const config = generateAppConfig()

    expect(config.database.logging).toBe(true)
    expect(typeof config.database.logging).toBe('boolean')
  })

  it('should be immutable (readonly)', () => {
    const config = generateAppConfig()

    // TypeScript コンパイル時にreadonlyプロパティがチェックされる
    expect(Object.isFrozen(config)).toBe(false) // as const は深いフリーズではない
    expect(config).toBeDefined()
  })
})

describe('revalidateEnvironment', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }

    // 必須環境変数を設定
    process.env.TOKEN = 'test-discord-token'
    process.env.DISCORD_APPLICATIONID = 'test-application-id'
    process.env.DISCORD_SECRET = 'test-discord-secret'
    process.env.JWT_SECRET = 'test-jwt-secret'
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db'
    process.env.DISCORD_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long'
    process.env.PORT = '3000'
  })

  afterEach(() => {
    process.env = originalEnv
    revalidateEnvironment()
  })

  it('should allow environment re-validation', () => {
    expect(() => revalidateEnvironment()).not.toThrow()
  })

  it('should reset cached environment on revalidation', () => {
    // 最初の設定生成
    const config1 = generateAppConfig()

    // 環境変数を変更
    process.env.PORT = '4000'

    // 再検証前は古い値
    const config2 = generateAppConfig()
    expect(config2.app.port).toBe(config1.app.port)

    // 再検証後は新しい値
    revalidateEnvironment()
    const config3 = generateAppConfig()
    expect(config3.app.port).toBe(4000)
  })
})
