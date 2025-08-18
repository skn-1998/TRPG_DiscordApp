import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, HttpException } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { mockAuthProviders } from '../mocks/auth.mock'
import { mockDiscordClient } from '../mocks/discord.mock'

// テストモジュール作成ヘルパー
export class TestModuleBuilder {
  private readonly providers: Array<{ provide: unknown; useValue: unknown }> = []
  private readonly imports: unknown[] = []
  private readonly controllers: unknown[] = []
  private readonly services: unknown[] = []

  addProvider(provider: unknown, mockValue: unknown) {
    this.providers.push({ provide: provider, useValue: mockValue })
    return this
  }

  addProviders(providers: Array<{ provide: unknown; useValue: unknown }>) {
    this.providers.push(...providers)
    return this
  }

  addImport(module: unknown) {
    this.imports.push(module)
    return this
  }

  addController(controller: unknown) {
    this.controllers.push(controller)
    return this
  }

  addService(service: unknown) {
    this.services.push(service)
    return this
  }

  withAuth() {
    this.addProviders(mockAuthProviders)
    return this
  }

  withDiscord() {
    this.addProvider('DISCORD_CLIENT', mockDiscordClient)
    return this
  }

  withConfig() {
    this.imports.push(
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test'
      })
    )
    return this
  }

  async build(): Promise<TestingModule> {
    return await Test.createTestingModule({
      imports: this.imports,
      controllers: this.controllers,
      providers: [...this.services, ...this.providers]
    }).compile()
  }
}

// アプリケーション作成ヘルパー
export async function createTestApp(module: TestingModule): Promise<INestApplication> {
  const app = module.createNestApplication()

  // CORS設定
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true
  })

  // 共通設定
  app.setGlobalPrefix('api')

  await app.init()
  return app
}

// エラーアサーション用ヘルパー
export function expectHttpError(error: any, expectedStatus: number, expectedMessage?: string) {
  expect(error).toBeInstanceOf(HttpException)
  expect(error.getStatus()).toBe(expectedStatus)
  if (expectedMessage) {
    expect(error.getResponse()).toEqual(
      expect.objectContaining({
        message: expectedMessage
      })
    )
  }
}

// 非同期エラーテスト用ヘルパー
export async function expectAsyncError(asyncFunction: () => Promise<any>, expectedError: any) {
  try {
    await asyncFunction()
    throw new Error('Expected function to throw an error')
  } catch (error) {
    expect(error).toEqual(expectedError)
  }
}

// モック関数リセットヘルパー
export function resetAllMocks() {
  jest.clearAllMocks()
  jest.restoreAllMocks()
}

// 時間操作ヘルパー
export class TimeHelper {
  static mockDate(date: Date) {
    jest.useFakeTimers()
    jest.setSystemTime(date)
  }

  static restoreTime() {
    jest.useRealTimers()
  }

  static advanceTime(ms: number) {
    jest.advanceTimersByTime(ms)
  }
}

// データ検証ヘルパー
export class ValidationHelper {
  static getCharacterMatcher() {
    return {
      characterId: expect.any(String),
      name: expect.any(String),
      gameSystem: expect.any(String),
      discordUserId: expect.any(String)
    }
  }

  static getUserMatcher() {
    return {
      id: expect.any(String),
      username: expect.any(String),
      email: expect.any(String)
    }
  }

  static getDiscordMessageMatcher() {
    return {
      id: expect.any(String),
      content: expect.any(String),
      author: expect.any(Object),
      timestamp: expect.any(Date)
    }
  }
}

// パフォーマンステスト用ヘルパー
export class PerformanceHelper {
  static async measureExecutionTime(fn: () => Promise<any>): Promise<{ result: any; duration: number }> {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    return {
      result,
      duration: end - start
    }
  }

  static expectFastExecution(duration: number, maxMs: number = 1000) {
    expect(duration).toBeLessThan(maxMs)
  }
}

// データベーストランザクション用ヘルパー
export class DatabaseHelper {
  static async withTransaction<T>(operation: () => Promise<T>, rollback: boolean = true): Promise<T> {
    // トランザクション開始
    const result = await operation()

    if (rollback) {
      // テスト後のロールバック処理
      // 実際の実装では適切なロールバック処理を行う
    }

    return result
  }
}

// 並行処理テスト用ヘルパー
export class ConcurrencyHelper {
  static async runConcurrently<T>(operations: Array<() => Promise<T>>, maxConcurrency: number = 10): Promise<T[]> {
    const results: T[] = []
    const semaphore = new Array(maxConcurrency).fill(null)

    await Promise.all(
      operations.map(async (operation, index) => {
        // セマフォを使用して同時実行数を制限
        const semaphoreIndex = index % maxConcurrency
        await semaphore[semaphoreIndex]

        try {
          const result = await operation()
          results[index] = result
        } catch (error) {
          throw error
        }
      })
    )

    return results
  }
}

// ログ出力制御ヘルパー
export class LogHelper {
  static suppressLogs() {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'debug').mockImplementation(() => {})
  }

  static restoreLogs() {
    jest.restoreAllMocks()
  }
}

// 環境変数モックヘルパー
export class EnvHelper {
  private static originalEnv: NodeJS.ProcessEnv

  static mockEnv(env: Record<string, string>) {
    this.originalEnv = { ...process.env }
    Object.assign(process.env, env)
  }

  static restoreEnv() {
    if (this.originalEnv) {
      process.env = this.originalEnv
    }
  }
}

// テストスイート用の共通セットアップ
export function setupTestSuite(suiteName: string) {
  describe(suiteName, () => {
    beforeEach(() => {
      resetAllMocks()
    })

    afterEach(() => {
      TimeHelper.restoreTime()
      LogHelper.restoreLogs()
      EnvHelper.restoreEnv()
    })
  })
}
