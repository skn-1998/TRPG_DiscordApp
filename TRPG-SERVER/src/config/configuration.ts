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
      diceRollCategory: env.DICE_ROLL_CATEGORY!,
      // チャンネルキャッシュのTTL（ミリ秒）
      cacheTtl: env.DISCORD_CACHE_TTL!,
      // チャンネルごとのメッセージキャッシュ上限
      messageCacheLimit: env.DISCORD_MESSAGE_CACHE_LIMIT!,
      // チャンネルキャッシュの上限数
      channelCacheLimit: env.DISCORD_CHANNEL_CACHE_LIMIT!,
      // Discordモックモード（テスト等でDiscord API登録をスキップ）
      testMockDiscord: env.TEST_MOCK_DISCORD!
    },

    // 認証設定
    auth: {
      // [必須] JWT署名用の秘密鍵
      jwtSecret: env.JWT_SECRET,
      // JWTトークンの有効期限（秒）
      jwtExpiresIn: env.JWT_EXPIRES_IN!,
      redirectUrl: env.REDIRECT_URL! ?? 'http://127.0.0.1:5173'
    },

    security: {
      discordTokenEncryptionKey: env.DISCORD_TOKEN_ENCRYPTION_KEY
    },

    // ログ設定
    logging: {
      // ログレベル
      level: env.LOG_LEVEL!,
      // ファイルログの有効/無効
      fileEnabled: env.LOG_FILE_ENABLE!,
      // コンソールログの有効/無効
      consoleEnabled: env.LOG_CONSOLE_ENABLE!,
      // ログファイルのパス
      filePath: env.LOG_FILE_PATH!,
      // エラーログファイルのパス
      errorFilePath: env.LOG_ERROR_FILE_PATH!
    },

    prototype: {
      characterNameUpdate: process.env.PROTOTYPE_CHARACTER_NAME_UPDATE === 'true',
      eventDriven: process.env.PROTOTYPE_EVENT_DRIVEN === 'true',
      discordIntegration: process.env.PROTOTYPE_DISCORD_INTEGRATION === 'true',
      enableLogging: process.env.PROTOTYPE_ENABLE_LOGGING === 'true'
    }
  } as const
}

/**
 * 設定値の型定義
 * generateAppConfig関数の戻り値から型を自動生成
 */
export type AppConfig = ReturnType<typeof generateAppConfig>

/**
 * 環境変数の再検証（テスト用）
 */
export function revalidateEnvironment(): void {
  validatedEnvironment = null
}
