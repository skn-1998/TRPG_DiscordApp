/**
 * 環境変数のバリデーションとパース
 */

import { EnvironmentSchema, DEFAULT_VALUES, REQUIRED_VARIABLES, TYPE_CONVERTERS } from './schemas/environment.schema'

/**
 * バリデーションエラーの詳細情報
 */
export interface ValidationError {
  variable: string
  message: string
  value?: string
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  success: boolean
  data?: EnvironmentSchema
  errors?: ValidationError[]
}

/**
 * 環境変数をバリデーションしてパースする
 */
export class EnvironmentValidator {
  /**
   * 環境変数をバリデーションして型安全なオブジェクトを返す
   */
  static validate(env: NodeJS.ProcessEnv = process.env): ValidationResult {
    const errors: ValidationError[] = []
    const result: Partial<EnvironmentSchema> = {}

    try {
      // 必須変数のチェック
      for (const variable of REQUIRED_VARIABLES) {
        if (!env[variable]) {
          errors.push({
            variable,
            message: `必須環境変数 ${variable} が設定されていません`,
            value: env[variable]
          })
        }
      }

      // 各環境変数のパースと検証
      result.NODE_ENV = TYPE_CONVERTERS.nodeEnv(env.NODE_ENV)
      result.PORT = TYPE_CONVERTERS.number(env.PORT, DEFAULT_VALUES.PORT)

      // Discord設定
      result.TOKEN = TYPE_CONVERTERS.string(env.TOKEN)
      result.DISCORD_APPLICATIONID = TYPE_CONVERTERS.string(env.DISCORD_APPLICATIONID)
      result.DISCORD_SECRET = TYPE_CONVERTERS.string(env.DISCORD_SECRET)
      result.GUILDID = env.GUILDID ? TYPE_CONVERTERS.string(env.GUILDID) : undefined

      // 認証設定
      result.JWT_SECRET = TYPE_CONVERTERS.string(env.JWT_SECRET)
      result.JWT_EXPIRES_IN = TYPE_CONVERTERS.number(env.JWT_EXPIRES_IN, DEFAULT_VALUES.JWT_EXPIRES_IN)
      result.REDIRECT_URL = TYPE_CONVERTERS.string(env.REDIRECT_URL, DEFAULT_VALUES.REDIRECT_URL)

      // データベース設定
      result.MONGODB_URI = TYPE_CONVERTERS.string(env.MONGODB_URI)
      result.DB_LOGGING = TYPE_CONVERTERS.boolean(env.DB_LOGGING, DEFAULT_VALUES.DB_LOGGING)

      // フロントエンド設定
      result.FRONTEND_URL = TYPE_CONVERTERS.string(env.FRONTEND_URL, DEFAULT_VALUES.FRONTEND_URL)

      // Discord カテゴリー設定
      result.CHARACTER_CATEGORY = TYPE_CONVERTERS.string(env.CHARACTER_CATEGORY, DEFAULT_VALUES.CHARACTER_CATEGORY)
      result.DICE_ROLL_CATEGORY = TYPE_CONVERTERS.string(env.DICE_ROLL_CATEGORY, DEFAULT_VALUES.DICE_ROLL_CATEGORY)

      // 暗号化キー
      result.DISCORD_TOKEN_ENCRYPTION_KEY = TYPE_CONVERTERS.string(env.DISCORD_TOKEN_ENCRYPTION_KEY)

      // 追加のバリデーション
      this.validatePort(result.PORT, errors)
      this.validateUrl(result.FRONTEND_URL, 'FRONTEND_URL', errors)
      this.validateMongoUri(result.MONGODB_URI, errors)

      // 機密値の最小長(32文字)検証は本番(production)でのみ強制する。
      // 必須チェック（値の存在自体）は全環境で行うが、最小長は本番のみエラーにする。
      // dev/test では最小長未満を許容（警告のみ・本番で強制）し、ローカルの短い秘密でも起動できるようにする。
      // （このファイルは Nest 起動前の静的バリデータで Logger を持たないため、警告は出力しない）
      if (result.NODE_ENV === 'production') {
        this.validateSecretMinLength(result.JWT_SECRET, 'JWT_SECRET', 32, errors)
        this.validateSecretMinLength(result.DISCORD_TOKEN_ENCRYPTION_KEY, 'DISCORD_TOKEN_ENCRYPTION_KEY', 32, errors)
      }

      // REDIRECT_URLは値が設定されている場合のみURL形式を検証
      if (result.REDIRECT_URL) {
        this.validateUrl(result.REDIRECT_URL, 'REDIRECT_URL', errors)
      }

      if (errors.length > 0) {
        return { success: false, errors }
      }

      return {
        success: true,
        data: result as EnvironmentSchema
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      errors.push({
        variable: 'UNKNOWN',
        message: `環境変数の処理中にエラーが発生しました: ${errorMessage}`
      })

      return { success: false, errors }
    }
  }

  /**
   * ポート番号のバリデーション
   */
  private static validatePort(port: number, errors: ValidationError[]): void {
    if (port < 1 || port > 65535) {
      errors.push({
        variable: 'PORT',
        message: 'PORTは1-65535の範囲で指定してください',
        value: port.toString()
      })
    }
  }

  /**
   * URLのバリデーション
   */
  private static validateUrl(url: string, variable: string, errors: ValidationError[]): void {
    try {
      new URL(url)
    } catch {
      errors.push({
        variable,
        message: `${variable}は有効なURLを指定してください`,
        value: url
      })
    }
  }

  /**
   * MongoDB URIのバリデーション
   */
  private static validateMongoUri(uri: string, errors: ValidationError[]): void {
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      errors.push({
        variable: 'MONGODB_URI',
        message: 'MONGODB_URIはmongodbスキームで始まる必要があります',
        value: uri
      })
    }
  }

  /**
   * 機密値の最小長バリデーション
   * 機密の中身は error.value に含めず、長さのみをメッセージに含める
   */
  private static validateSecretMinLength(
    value: string,
    variable: string,
    min: number,
    errors: ValidationError[]
  ): void {
    // 必須チェックは別途行われるため、未設定（空）の場合はここでは検証しない
    if (!value) {
      return
    }
    if (value.length < min) {
      errors.push({
        variable,
        message: `${variable}は${min}文字以上で指定してください (長さ: ${value.length}文字)`
        // 機密値のため value は渡さない
      })
    }
  }

  /**
   * バリデーションエラーを整形して出力
   */
  static formatErrors(errors: ValidationError[]): string {
    return errors
      .map((error) => `❌ ${error.variable}: ${error.message}${error.value ? ` (現在の値: ${error.value})` : ''}`)
      .join('\n')
  }
}
