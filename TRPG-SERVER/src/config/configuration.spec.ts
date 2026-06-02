import { EnvironmentValidator } from './environment.validator'
import type { EnvironmentSchema } from './schemas/environment.schema'
import { generateAppConfig, revalidateEnvironment } from './configuration'

/**
 * configuration.ts は EnvironmentValidator.validate() の検証結果を組み替えて
 * アプリ設定オブジェクトを生成する factory。副作用の境界は次の2つ:
 *   - EnvironmentValidator.validate（環境変数検証） → jest.mock で固定
 *   - process.env.PROTOTYPE_*（直接参照） → 各テストで一時設定し復元
 * これらを制御し、組み立てロジック・キャッシュ・revalidate を検証する。
 */
jest.mock('./environment.validator')

const mockedValidator = EnvironmentValidator as jest.Mocked<typeof EnvironmentValidator>

/** validate が返す検証済み env の最小構成（全フィールド埋め） */
const buildValidatedEnv = (overrides: Partial<EnvironmentSchema> = {}): EnvironmentSchema => ({
  NODE_ENV: 'development',
  PORT: 3000,
  TOKEN: 'discord-token',
  DISCORD_APPLICATIONID: 'app-id',
  DISCORD_SECRET: 'discord-secret',
  GUILDID: 'guild-123',
  DISCORD_CACHE_TTL: 300000,
  DISCORD_MESSAGE_CACHE_LIMIT: 30,
  DISCORD_CHANNEL_CACHE_LIMIT: 50,
  TEST_MOCK_DISCORD: false,
  JWT_SECRET: 'jwt-secret',
  JWT_EXPIRES_IN: 86400,
  REDIRECT_URL: 'http://127.0.0.1:5173',
  MONGODB_URI: 'mongodb://localhost:27017/test_db',
  DB_LOGGING: false,
  FRONTEND_URL: 'http://127.0.0.1:5173',
  CHARACTER_CATEGORY: 'キャラクター',
  DICE_ROLL_CATEGORY: 'ダイスロールチャンネル',
  DISCORD_TOKEN_ENCRYPTION_KEY: 'encryption-key',
  LOG_LEVEL: 'info',
  LOG_FILE_ENABLE: true,
  LOG_CONSOLE_ENABLE: true,
  LOG_FILE_PATH: 'logs/app.log',
  LOG_ERROR_FILE_PATH: 'logs/error.log',
  ...overrides
})

const mockValidateSuccess = (env: EnvironmentSchema): void => {
  mockedValidator.validate.mockReturnValue({ success: true, data: env })
}

describe('configuration', () => {
  // PROTOTYPE_* は process.env を直接参照するため、テストごとに退避・復元する
  const prototypeKeys = [
    'PROTOTYPE_CHARACTER_NAME_UPDATE',
    'PROTOTYPE_EVENT_DRIVEN',
    'PROTOTYPE_DISCORD_INTEGRATION',
    'PROTOTYPE_ENABLE_LOGGING'
  ] as const
  let savedPrototypeEnv: Record<string, string | undefined>

  beforeEach(() => {
    jest.clearAllMocks()
    revalidateEnvironment() // モジュールキャッシュをクリアして毎回 validate を走らせる
    savedPrototypeEnv = {}
    for (const key of prototypeKeys) {
      savedPrototypeEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of prototypeKeys) {
      if (savedPrototypeEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = savedPrototypeEnv[key]
      }
    }
  })

  describe('generateAppConfig', () => {
    it('検証済み env を各設定セクションへマッピングする', () => {
      mockValidateSuccess(buildValidatedEnv())

      const config = generateAppConfig()

      expect(config.app).toEqual({
        environment: 'development',
        port: 3000,
        frontendUrl: 'http://127.0.0.1:5173'
      })
      expect(config.database).toEqual({ mongoUri: 'mongodb://localhost:27017/test_db', logging: false })
      expect(config.discord.token).toBe('discord-token')
      expect(config.discord.applicationId).toBe('app-id')
      expect(config.discord.cacheTtl).toBe(300000)
      expect(config.auth.jwtSecret).toBe('jwt-secret')
      expect(config.security.discordTokenEncryptionKey).toBe('encryption-key')
      expect(config.logging.level).toBe('info')
    })

    it('auth.redirectUrl は env の値を優先する', () => {
      mockValidateSuccess(buildValidatedEnv({ REDIRECT_URL: 'https://custom.example.com/cb' }))

      const config = generateAppConfig()

      expect(config.auth.redirectUrl).toBe('https://custom.example.com/cb')
    })

    it('REDIRECT_URL が undefined のときは既定値 127.0.0.1:5173 を使う', () => {
      mockValidateSuccess(buildValidatedEnv({ REDIRECT_URL: undefined }))

      const config = generateAppConfig()

      expect(config.auth.redirectUrl).toBe('http://127.0.0.1:5173')
    })

    it('PROTOTYPE_* が "true" のフラグだけ true になる', () => {
      mockValidateSuccess(buildValidatedEnv())
      process.env.PROTOTYPE_EVENT_DRIVEN = 'true'
      process.env.PROTOTYPE_ENABLE_LOGGING = 'false'

      const config = generateAppConfig()

      expect(config.prototype.eventDriven).toBe(true)
      expect(config.prototype.enableLogging).toBe(false)
      expect(config.prototype.characterNameUpdate).toBe(false)
      expect(config.prototype.discordIntegration).toBe(false)
    })

    it('検証結果をキャッシュし、2回目は validate を呼ばない', () => {
      mockValidateSuccess(buildValidatedEnv())

      generateAppConfig()
      generateAppConfig()

      expect(mockedValidator.validate).toHaveBeenCalledTimes(1)
    })

    it('検証失敗時は process.exit(1) を呼ぶ', () => {
      mockedValidator.validate.mockReturnValue({
        success: false,
        errors: [{ variable: 'TOKEN', message: 'missing' }]
      })
      mockedValidator.formatErrors.mockReturnValue('formatted-errors')
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      try {
        generateAppConfig()
      } catch {
        // process.exit がモックされ実際には止まらないため後続で例外になりうる。検証対象は exit 呼び出し
      }

      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(mockedValidator.formatErrors).toHaveBeenCalled()

      exitSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })

  describe('revalidateEnvironment', () => {
    it('キャッシュをクリアし、次回 generateAppConfig で validate を再実行させる', () => {
      mockValidateSuccess(buildValidatedEnv())
      generateAppConfig()
      expect(mockedValidator.validate).toHaveBeenCalledTimes(1)

      revalidateEnvironment()
      generateAppConfig()

      expect(mockedValidator.validate).toHaveBeenCalledTimes(2)
    })
  })
})
