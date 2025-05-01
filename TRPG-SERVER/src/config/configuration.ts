/**
 * 型安全な設定値を生成するための関数群と設定値の型定義
 */

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
 */
export const generateAppConfig = () => {
  // 必須環境変数の検証
  const requiredVars = ['TOKEN', 'DISCORD_APPLICATIONID', 'DISCORD_SECRET', 'JWT_SECRET', 'MONGODB_URI']

  const missingVars = requiredVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    console.error(`必須環境変数が設定されていません: ${missingVars.join(', ')}`)
    process.exit(1)
  }

  return {
    // アプリケーション設定
    app: {
      environment: convertOrDefault(process.env.NODE_ENV, 'development'),
      port: convertIntOrDefault(process.env.PORT, 3000),
      frontendUrl: convertOrDefault(process.env.FRONTEND_URL, 'http://localhost:5173')
    },

    // データベース設定
    database: {
      // [必須] MongoDB接続URI
      mongoUri: process.env.MONGODB_URI,
      // ログを出力するかどうか
      logging: convertBooleanOrDefault(process.env.DB_LOGGING, false)
    },

    // Discord設定
    discord: {
      // [必須] Discordトークン
      token: process.env.TOKEN,
      // [必須] DiscordアプリケーションID
      applicationId: process.env.DISCORD_APPLICATIONID,
      // [必須] Discordシークレット
      secret: process.env.DISCORD_SECRET,
      // Discord GuildID
      guildId: process.env.GUILDID,
      // キャラクターカテゴリー名
      characterCategory: convertOrDefault(process.env.CHARACTER_CATEGORY, 'キャラクター'),
      // ダイスロールカテゴリー名
      diceRollCategory: convertOrDefault(process.env.DICE_ROLL_CATEGORY, 'ダイスロールチャンネル')
    },

    // 認証設定
    auth: {
      // [必須] JWT署名用の秘密鍵
      jwtSecret: process.env.JWT_SECRET,
      // JWTトークンの有効期限（秒）
      jwtExpiresIn: convertIntOrDefault(process.env.JWT_EXPIRES_IN, 86400) // デフォルト24時間
    }
  }
}

/**
 * 設定値の型定義
 * generateAppConfig関数の戻り値から型を自動生成
 */
export type AppConfig = ReturnType<typeof generateAppConfig>
