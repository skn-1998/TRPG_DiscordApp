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
  DISCORD_CACHE_TTL?: number // オプショナル（チャンネルキャッシュTTL）
  DISCORD_MESSAGE_CACHE_LIMIT?: number // オプショナル（メッセージキャッシュ上限）
  DISCORD_CHANNEL_CACHE_LIMIT?: number // オプショナル（チャンネルキャッシュ上限）
  TEST_MOCK_DISCORD?: boolean // オプショナル（Discordモック制御）

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

  // 暗号化キー
  DISCORD_TOKEN_ENCRYPTION_KEY: string

  // ログ設定
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error' // オプショナル
  LOG_FILE_ENABLE?: boolean // オプショナル
  LOG_CONSOLE_ENABLE?: boolean // オプショナル
  LOG_FILE_PATH?: string // オプショナル
  LOG_ERROR_FILE_PATH?: string // オプショナル
}

/**
 * 環境変数のデフォルト値
 */
export const DEFAULT_VALUES: Partial<EnvironmentSchema> = {
  NODE_ENV: 'development',
  PORT: 3000,
  JWT_EXPIRES_IN: 86400, // 24時間
  DB_LOGGING: false,
  FRONTEND_URL: 'http://127.0.0.1:5173', // IPv6回避のため127.0.0.1を使用
  CHARACTER_CATEGORY: 'キャラクター',
  DICE_ROLL_CATEGORY: 'ダイスロールチャンネル',
  DISCORD_CACHE_TTL: 300000, // 5分
  DISCORD_MESSAGE_CACHE_LIMIT: 30,
  DISCORD_CHANNEL_CACHE_LIMIT: 50,
  TEST_MOCK_DISCORD: false,
  LOG_LEVEL: 'info',
  LOG_FILE_ENABLE: true,
  LOG_CONSOLE_ENABLE: true,
  LOG_FILE_PATH: 'logs/app.log',
  LOG_ERROR_FILE_PATH: 'logs/error.log'
} as const

/**
 * 必須環境変数のリスト
 */
export const REQUIRED_VARIABLES: (keyof EnvironmentSchema)[] = [
  'TOKEN',
  'DISCORD_APPLICATIONID',
  'DISCORD_SECRET',
  'JWT_SECRET',
  'MONGODB_URI',
  'DISCORD_TOKEN_ENCRYPTION_KEY'
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
