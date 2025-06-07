/**
 * Remix用型安全な設定値を生成するための関数群と設定値の型定義
 */

import { EnvironmentValidator } from './environment.validator'
import { EnvironmentSchema } from './schemas/environment.schema'

/**
 * 検証済み環境変数のキャッシュ
 */
let validatedEnvironment: EnvironmentSchema | null = null

/**
 * 環境変数を検証して取得
 */
function getValidatedEnvironment(): EnvironmentSchema {
  if (validatedEnvironment) {
    return validatedEnvironment
  }

  const validation = EnvironmentValidator.validate()

  if (!validation.success) {
    console.error('🚨 環境変数の検証に失敗しました:')
    console.error(EnvironmentValidator.formatErrors(validation.errors!))

    // Remixでは即座に終了せず、エラーを投げる
    throw new Error('環境変数の検証に失敗しました')
  }

  validatedEnvironment = validation.data!
  return validatedEnvironment
}

/**
 * Remix用アプリケーション設定値を生成する
 */
export const generateAppConfig = () => {
  const env = getValidatedEnvironment()

  return {
    // アプリケーション設定
    app: {
      environment: env.NODE_ENV,
      port: env.PORT || 3000
    },

    // Discord OAuth設定
    discord: {
      secret: env.DISCORD_SECRET,
      applicationId: env.DISCORD_APPLICATIONID
    },

    // サーバー設定
    server: {
      domain: env.SERVER_DOMAIN || 'http://localhost:3000',
      hostDomain: env.HOST_DOMAIN || 'http://localhost:5173'
    },

    // データベース設定
    database: {
      url: env.DATABASE_URL,
      logging: env.DB_LOGGING || false
    }
  } as const
}

/**
 * 設定値の型定義
 * generateAppConfig関数の戻り値から型を自動生成
 */
export type AppConfig = ReturnType<typeof generateAppConfig>

/**
 * 利用可能な設定パスの型定義
 * IntelliSenseで予測変換される設定パス
 */
export type ConfigPaths =
  | 'app.environment'
  | 'app.port'
  | 'discord.secret'
  | 'discord.applicationId'
  | 'server.domain'
  | 'server.hostDomain'
  | 'database.url'
  | 'database.logging'

/**
 * 環境変数の再検証（テスト用）
 */
export function revalidateEnvironment(): void {
  validatedEnvironment = null
}

/**
 * 設定値をドット記法で取得するためのヘルパー関数
 */
export function getConfigValue<T extends ConfigPaths>(path: T): unknown {
  const config = generateAppConfig()
  const keys = path.split('.') as string[]

  let result: unknown = config
  for (const key of keys) {
    result = (result as Record<string, unknown>)[key]
  }

  return result
}
