/**
 * 型安全な設定値を生成するための関数群と設定値の型定義
 * リファクタリング済み: 新しい環境変数バリデーションシステムを使用
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
    process.exit(1)
  }

  validatedEnvironment = validation.data!
  return validatedEnvironment
}

/**
 * 文字列変換またはデフォルト値を返す
 */
const convertOrDefault = (raw: string | undefined, defaultValue: string): string => {
  if (!raw) return defaultValue
  return raw
}

/**
 * 数値変換またはデフォルト値を返す
 */
const convertIntOrDefault = (raw: string | undefined, defaultValue: number): number => {
  if (!raw) return defaultValue
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return defaultValue
  return parsed
}

/**
 * 真偽値変換またはデフォルト値を返す
 */
const convertBooleanOrDefault = (raw: string | undefined, defaultValue: boolean): boolean => {
  if (!raw) return defaultValue
  if (raw !== 'true' && raw !== 'false') return defaultValue
  if (raw === 'true') return true
  if (raw === 'false') return false
  return defaultValue
}

/**
 * アプリケーション設定値を生成する
 * 新しいバリデーションシステムを使用して型安全性を確保
 */
export const generateAppConfig = () => {
  const env = getValidatedEnvironment()

  return {
    // アプリケーション設定
    app: {
      environment: env.NODE_ENV,
      port: env.PORT,
      frontendUrl: env.FRONTEND_URL!
    },

    // データベース設定
    database: {
      // [必須] MongoDB接続URI
      mongoUri: env.MONGODB_URI,
      // ログを出力するかどうか
      logging: env.DB_LOGGING!
    },

    // Discord設定
    discord: {
      // [必須] Discordトークン
      token: env.TOKEN,
      // [必須] DiscordアプリケーションID
      applicationId: env.DISCORD_APPLICATIONID,
      // [必須] Discordシークレット
      secret: env.DISCORD_SECRET,
      // Discord GuildID
      guildId: env.GUILDID,
      // キャラクターカテゴリー名
      characterCategory: env.CHARACTER_CATEGORY!,
      // ダイスロールカテゴリー名
      diceRollCategory: env.DICE_ROLL_CATEGORY!
    },

    // 認証設定
    auth: {
      // [必須] JWT署名用の秘密鍵
      jwtSecret: env.JWT_SECRET,
      // JWTトークンの有効期限（秒）
      jwtExpiresIn: env.JWT_EXPIRES_IN!,
      redirectUrl: env.REDIRECT_URL!
    },

    security: {
      discordTokenEncryptionKey: env.DISCORD_TOKEN_ENCRYPTION_KEY
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
  | 'app.frontendUrl'
  | 'database.mongoUri'
  | 'database.logging'
  | 'discord.token'
  | 'discord.applicationId'
  | 'discord.secret'
  | 'discord.guildId'
  | 'discord.characterCategory'
  | 'discord.diceRollCategory'
  | 'auth.jwtSecret'
  | 'auth.jwtExpiresIn'
  | 'auth.redirectUrl'
  | 'security.discordTokenEncryptionKey'

/**
 * 環境変数の再検証（テスト用）
 */
export function revalidateEnvironment(): void {
  validatedEnvironment = null
}
