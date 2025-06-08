/**
 * Remix用環境変数のバリデーションスキーマ
 * 型安全性とランタイムバリデーションを提供
 */

export interface EnvironmentSchema {
  // アプリケーション設定
  NODE_ENV: 'development' | 'production' | 'test'
  PORT?: number

  // Discord OAuth設定
  DISCORD_SECRET: string
  DISCORD_APPLICATIONID: string

  // サーバー設定
  SERVER_DOMAIN?: string
  HOST_DOMAIN?: string

  // データベース設定（将来的な拡張用）
  DATABASE_URL?: string
  DB_LOGGING?: boolean
}

/**
 * 環境変数のデフォルト値
 */
export const DEFAULT_VALUES: Partial<EnvironmentSchema> = {
  NODE_ENV: 'development',
  PORT: 5173,
  DB_LOGGING: false,
  SERVER_DOMAIN: 'http://127.0.0.1:3000', // IPv6回避のため127.0.0.1を使用
  HOST_DOMAIN: 'http://127.0.0.1:5173' // IPv6回避のため127.0.0.1を使用
} as const

/**
 * 必須環境変数のリスト
 */
export const REQUIRED_VARIABLES: (keyof EnvironmentSchema)[] = ['DISCORD_SECRET', 'DISCORD_APPLICATIONID'] as const

/**
 * 環境変数の型変換関数
 */
export const TYPE_CONVERTERS = {
  string: (value: string | undefined, defaultValue?: string): string => {
    return value ?? defaultValue ?? ''
  },

  number: (value: string | undefined, defaultValue?: number): number => {
    if (!value) return defaultValue ?? 0
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return defaultValue ?? 0
    return parsed
  },

  boolean: (value: string | undefined, defaultValue?: boolean): boolean => {
    if (!value) return defaultValue ?? false
    if (value === 'true') return true
    if (value === 'false') return false
    return defaultValue ?? false
  },

  nodeEnv: (value: string | undefined): EnvironmentSchema['NODE_ENV'] => {
    if (value === 'production' || value === 'test' || value === 'development') {
      return value
    }
    return 'development'
  }
} as const
