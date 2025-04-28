/**
 * 環境変数の型定義と検証ユーティリティー
 * アプリケーションが必要とする環境変数の一元管理を行う
 */

// 環境変数の型定義
export interface EnvironmentVariables {
  // サーバー設定
  NODE_ENV: 'development' | 'production' | 'test'
  PORT: number

  // Discord設定
  TOKEN: string
  DISCORD_APPLICATIONID: string
  DISCORD_SECRET: string
  GUILDID: string

  // 認証設定
  JWT_SECRET: string

  // データベース設定
  MONGODB_URI: string

  // フロントエンド設定
  FRONTEND_URL: string
}

// 環境変数のデフォルト値
const defaultValues: Partial<EnvironmentVariables> = {
  NODE_ENV: 'development' as const,
  PORT: 3000,
  FRONTEND_URL: 'http://localhost:5173'
}

/**
 * 環境変数を取得、検証して返す
 * 環境変数が未設定の場合はデフォルト値を使用
 * @returns 検証済みの環境変数
 */
export function getEnvironmentVariables(): EnvironmentVariables {
  const env = process.env

  // 型変換とデフォルト値の適用
  const environment: EnvironmentVariables = {
    NODE_ENV: (env.NODE_ENV as EnvironmentVariables['NODE_ENV']) || defaultValues.NODE_ENV,
    PORT: env.PORT ? parseInt(env.PORT, 10) : defaultValues.PORT,
    TOKEN: env.TOKEN,
    DISCORD_APPLICATIONID: env.DISCORD_APPLICATIONID,
    DISCORD_SECRET: env.DISCORD_SECRET,
    GUILDID: env.GUILDID,
    JWT_SECRET: env.JWT_SECRET,
    MONGODB_URI: env.MONGODB_URI,
    FRONTEND_URL: env.FRONTEND_URL || defaultValues.FRONTEND_URL
  }

  // 必須環境変数の検証
  const requiredVars = ['TOKEN', 'DISCORD_APPLICATIONID', 'DISCORD_SECRET', 'JWT_SECRET', 'MONGODB_URI']

  const missingVars = requiredVars.filter((varName) => !environment[varName])

  if (missingVars.length > 0) {
    throw new Error(`必須環境変数が設定されていません: ${missingVars.join(', ')}`)
  }

  return environment
}

// 型安全な環境変数へのアクセスのための単一インスタンス
export const env = getEnvironmentVariables()
