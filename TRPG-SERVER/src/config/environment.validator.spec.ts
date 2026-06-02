import { EnvironmentValidator, ValidationError } from './environment.validator'
import { DEFAULT_VALUES } from './schemas/environment.schema'

/**
 * 必須環境変数をすべて満たす最小構成の env を生成するヘルパー。
 * 各テストはこれをベースに分岐対象だけを上書きする（process.env は触らない）。
 */
const validEnv = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: 'development',
  TOKEN: 'discord-token',
  DISCORD_APPLICATIONID: 'application-id',
  DISCORD_SECRET: 'discord-secret',
  JWT_SECRET: 'jwt-secret-32-characters-long-xxxxx',
  MONGODB_URI: 'mongodb://localhost:27017/test_db',
  DISCORD_TOKEN_ENCRYPTION_KEY: 'encryption-key-32-characters-long-x',
  ...overrides
})

/** errors 配列から特定変数のエラーを取り出すヘルパー */
const errorsFor = (errors: ValidationError[] | undefined, variable: string): ValidationError[] =>
  (errors ?? []).filter((e) => e.variable === variable)

describe('EnvironmentValidator', () => {
  describe('validate', () => {
    describe('正常系', () => {
      it('必須変数がすべて揃っていれば success=true を返す', () => {
        const result = EnvironmentValidator.validate(validEnv())

        expect(result.success).toBe(true)
        expect(result.errors).toBeUndefined()
        expect(result.data).toBeDefined()
      })

      it('未設定の任意項目にはデフォルト値が適用される', () => {
        const result = EnvironmentValidator.validate(validEnv())

        expect(result.data?.PORT).toBe(DEFAULT_VALUES.PORT)
        expect(result.data?.FRONTEND_URL).toBe(DEFAULT_VALUES.FRONTEND_URL)
        expect(result.data?.JWT_EXPIRES_IN).toBe(DEFAULT_VALUES.JWT_EXPIRES_IN)
        expect(result.data?.DB_LOGGING).toBe(DEFAULT_VALUES.DB_LOGGING)
        expect(result.data?.CHARACTER_CATEGORY).toBe(DEFAULT_VALUES.CHARACTER_CATEGORY)
        expect(result.data?.DICE_ROLL_CATEGORY).toBe(DEFAULT_VALUES.DICE_ROLL_CATEGORY)
      })

      it('数値項目は parseInt で数値に変換される', () => {
        const result = EnvironmentValidator.validate(validEnv({ PORT: '8080', JWT_EXPIRES_IN: '3600' }))

        expect(result.data?.PORT).toBe(8080)
        expect(result.data?.JWT_EXPIRES_IN).toBe(3600)
      })

      it('boolean項目は文字列から真偽値に変換される', () => {
        const result = EnvironmentValidator.validate(validEnv({ DB_LOGGING: 'true', TEST_MOCK_DISCORD: 'true' }))

        expect(result.data?.DB_LOGGING).toBe(true)
        expect(result.data?.TEST_MOCK_DISCORD).toBe(true)
      })

      it('GUILDID は未設定なら undefined になる', () => {
        const result = EnvironmentValidator.validate(validEnv())

        expect(result.data?.GUILDID).toBeUndefined()
      })

      it('GUILDID は設定されていればその値が入る', () => {
        const result = EnvironmentValidator.validate(validEnv({ GUILDID: 'guild-123' }))

        expect(result.data?.GUILDID).toBe('guild-123')
      })

      it('NODE_ENV が不正な値の場合は development にフォールバックする', () => {
        const result = EnvironmentValidator.validate(validEnv({ NODE_ENV: 'staging' }))

        expect(result.data?.NODE_ENV).toBe('development')
      })

      it('引数を省略した場合は process.env を参照する', () => {
        const original = { ...process.env }
        try {
          process.env = validEnv() as NodeJS.ProcessEnv

          const result = EnvironmentValidator.validate()

          expect(result.success).toBe(true)
        } finally {
          process.env = original
        }
      })
    })

    describe('必須変数の欠如', () => {
      it('TOKEN が無いと TOKEN のエラーを返す', () => {
        const env = validEnv()
        delete env.TOKEN

        const result = EnvironmentValidator.validate(env)

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'TOKEN')).toHaveLength(1)
      })

      it('必須変数がすべて欠如すると各変数分のエラーを返す', () => {
        const result = EnvironmentValidator.validate({ NODE_ENV: 'development' })

        expect(result.success).toBe(false)
        // 必須6変数 + MONGODB_URI スキーム検証(空文字列のため)で重複しうるが、
        // 少なくとも各必須変数の欠如エラーが含まれる
        const requiredVars = [
          'TOKEN',
          'DISCORD_APPLICATIONID',
          'DISCORD_SECRET',
          'JWT_SECRET',
          'MONGODB_URI',
          'DISCORD_TOKEN_ENCRYPTION_KEY'
        ]
        for (const v of requiredVars) {
          expect(errorsFor(result.errors, v).length).toBeGreaterThanOrEqual(1)
        }
      })

      it('空文字列の必須変数も欠如として扱われる', () => {
        const result = EnvironmentValidator.validate(validEnv({ JWT_SECRET: '' }))

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'JWT_SECRET').length).toBeGreaterThanOrEqual(1)
      })
    })

    describe('PORT のバリデーション', () => {
      it('範囲下限未満(0)はエラーになる', () => {
        const result = EnvironmentValidator.validate(validEnv({ PORT: '0' }))

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'PORT')).toHaveLength(1)
      })

      it('範囲上限超過(65536)はエラーになる', () => {
        const result = EnvironmentValidator.validate(validEnv({ PORT: '65536' }))

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'PORT')).toHaveLength(1)
      })

      it('境界値(1)は許容される', () => {
        const result = EnvironmentValidator.validate(validEnv({ PORT: '1' }))

        expect(errorsFor(result.errors, 'PORT')).toHaveLength(0)
      })

      it('境界値(65535)は許容される', () => {
        const result = EnvironmentValidator.validate(validEnv({ PORT: '65535' }))

        expect(errorsFor(result.errors, 'PORT')).toHaveLength(0)
      })
    })

    describe('URL のバリデーション', () => {
      it('FRONTEND_URL が不正な形式だとエラーになる', () => {
        const result = EnvironmentValidator.validate(validEnv({ FRONTEND_URL: 'not-a-url' }))

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'FRONTEND_URL')).toHaveLength(1)
      })

      it('REDIRECT_URL は設定されていれば形式を検証しエラーになりうる', () => {
        const result = EnvironmentValidator.validate(validEnv({ REDIRECT_URL: 'invalid' }))

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'REDIRECT_URL')).toHaveLength(1)
      })

      it('REDIRECT_URL が未設定なら検証されずエラーにならない', () => {
        const result = EnvironmentValidator.validate(validEnv())

        expect(errorsFor(result.errors, 'REDIRECT_URL')).toHaveLength(0)
      })

      it('REDIRECT_URL が有効なURLならエラーにならない', () => {
        const result = EnvironmentValidator.validate(validEnv({ REDIRECT_URL: 'https://example.com/cb' }))

        expect(errorsFor(result.errors, 'REDIRECT_URL')).toHaveLength(0)
      })
    })

    describe('MONGODB_URI のバリデーション', () => {
      it('mongodb:// スキームなら許容される', () => {
        const result = EnvironmentValidator.validate(validEnv({ MONGODB_URI: 'mongodb://host:27017/db' }))

        expect(errorsFor(result.errors, 'MONGODB_URI')).toHaveLength(0)
      })

      it('mongodb+srv:// スキームなら許容される', () => {
        const result = EnvironmentValidator.validate(validEnv({ MONGODB_URI: 'mongodb+srv://host/db' }))

        expect(errorsFor(result.errors, 'MONGODB_URI')).toHaveLength(0)
      })

      it('不正なスキームだとエラーになる', () => {
        const result = EnvironmentValidator.validate(validEnv({ MONGODB_URI: 'postgres://host/db' }))

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'MONGODB_URI')).toHaveLength(1)
      })
    })

    describe('機密値の最小長(本番のみ強制)', () => {
      let warnSpy: jest.SpyInstance

      beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      })

      afterEach(() => {
        jest.restoreAllMocks()
      })

      it('production で JWT_SECRET が32文字未満だとエラーになる', () => {
        const result = EnvironmentValidator.validate(validEnv({ NODE_ENV: 'production', JWT_SECRET: 'short' }))

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'JWT_SECRET')).toHaveLength(1)
      })

      it('production で DISCORD_TOKEN_ENCRYPTION_KEY が32文字未満だとエラーになる', () => {
        const result = EnvironmentValidator.validate(
          validEnv({ NODE_ENV: 'production', DISCORD_TOKEN_ENCRYPTION_KEY: 'short' })
        )

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'DISCORD_TOKEN_ENCRYPTION_KEY')).toHaveLength(1)
      })

      it('production で機密値が32文字以上ならエラーにならない', () => {
        const result = EnvironmentValidator.validate(validEnv({ NODE_ENV: 'production' }))

        expect(errorsFor(result.errors, 'JWT_SECRET')).toHaveLength(0)
        expect(errorsFor(result.errors, 'DISCORD_TOKEN_ENCRYPTION_KEY')).toHaveLength(0)
      })

      it('production の最小長エラーメッセージに機密値そのものを含めない', () => {
        const secret = 'super-secret-value'
        const result = EnvironmentValidator.validate(validEnv({ NODE_ENV: 'production', JWT_SECRET: secret }))

        const jwtError = errorsFor(result.errors, 'JWT_SECRET')[0]
        expect(jwtError.value).toBeUndefined()
        expect(jwtError.message).not.toContain(secret)
        expect(jwtError.message).toContain(`${secret.length}文字`)
      })

      it('development では機密値が短くてもエラーにならず警告のみ出す', () => {
        const result = EnvironmentValidator.validate(validEnv({ NODE_ENV: 'development', JWT_SECRET: 'short' }))

        expect(errorsFor(result.errors, 'JWT_SECRET')).toHaveLength(0)
        expect(warnSpy).toHaveBeenCalled()
      })

      it('development で機密値が十分な長さなら警告も出さない', () => {
        EnvironmentValidator.validate(validEnv({ NODE_ENV: 'development' }))

        expect(warnSpy).not.toHaveBeenCalled()
      })
    })

    describe('複数エラーの集約', () => {
      it('複数の検証違反が同時にあれば全て errors に含まれる', () => {
        const result = EnvironmentValidator.validate(
          validEnv({ PORT: '0', FRONTEND_URL: 'bad', MONGODB_URI: 'postgres://x' })
        )

        expect(result.success).toBe(false)
        expect(errorsFor(result.errors, 'PORT')).toHaveLength(1)
        expect(errorsFor(result.errors, 'FRONTEND_URL')).toHaveLength(1)
        expect(errorsFor(result.errors, 'MONGODB_URI')).toHaveLength(1)
      })
    })
  })

  describe('formatErrors', () => {
    it('value 付きエラーは「現在の値」を含めて整形する', () => {
      const formatted = EnvironmentValidator.formatErrors([
        { variable: 'PORT', message: 'PORTは1-65535の範囲で指定してください', value: '0' }
      ])

      expect(formatted).toContain('PORT')
      expect(formatted).toContain('現在の値: 0')
    })

    it('value 無しエラーは「現在の値」を含めない', () => {
      const formatted = EnvironmentValidator.formatErrors([
        { variable: 'JWT_SECRET', message: 'JWT_SECRETは32文字以上で指定してください (長さ: 5文字)' }
      ])

      expect(formatted).toContain('JWT_SECRET')
      expect(formatted).not.toContain('現在の値')
    })

    it('複数エラーは改行で連結される', () => {
      const formatted = EnvironmentValidator.formatErrors([
        { variable: 'A', message: 'msg-a' },
        { variable: 'B', message: 'msg-b' }
      ])

      expect(formatted.split('\n')).toHaveLength(2)
    })

    it('空配列なら空文字列を返す', () => {
      expect(EnvironmentValidator.formatErrors([])).toBe('')
    })
  })
})
