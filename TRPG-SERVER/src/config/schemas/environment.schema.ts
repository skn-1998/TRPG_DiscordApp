/**
 * 環境変数のバリデーションスキーマ
 * 型安全性とランタイムバリデーションを提供
 */

export interface EnvironmentSchema {
  // サーバー設定
  NODE_ENV: 'development' | 'production' | 'test'
  PORT: number

  // Discord設定
  TOKEN: string
  DISCORD_APPLICATIONID: string
  DISCORD_SECRET: string
  GUILDID?: string // オプショナル

  // 認証設定
  JWT_SECRET: string
  JWT_EXPIRES_IN?: number // オプショナル
  REDIRECT_URL?: string // オプショナル

  // データベース設定
  MONGODB_URI: string
  DB_LOGGING?: boolean // オプショナル

  // フロントエンド設定
  FRONTEND_URL?: string // オプショナル

  // Discord カテゴリー設定
  CHARACTER_CATEGORY?: string // オプショナル
  DICE_ROLL_CATEGORY?: string // オプショナル
}

/**
 * 環境変数のデフォルト値
 */
export const DEFAULT_VALUES: Partial<EnvironmentSchema> = {
  NODE_ENV: 'development',
  PORT: 3000,
  JWT_EXPIRES_IN: 86400, // 24時間
  DB_LOGGING: false,
  FRONTEND_URL: 'http://localhost:5173',
  CHARACTER_CATEGORY: 'キャラクター',
  DICE_ROLL_CATEGORY: 'ダイスロールチャンネル'
} as const

/**
 * 必須環境変数のリスト
 */
export const REQUIRED_VARIABLES: (keyof EnvironmentSchema)[] = [
  'TOKEN',
  'DISCORD_APPLICATIONID',
  'DISCORD_SECRET',
  'JWT_SECRET',
  'MONGODB_URI'
] as const

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
