/** Next.jsサーバー環境変数のバリデーションとパース */

import { EnvironmentSchema, DEFAULT_VALUES, REQUIRED_VARIABLES, TYPE_CONVERTERS } from './schemas/environment.schema'

function getRuntimeEnvironment(): Record<string, string | undefined> {
  if (typeof process !== 'undefined' && process.env) {
    return process.env
  }

  return {}
}

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
  static validate(env: Record<string, string | undefined> = getRuntimeEnvironment()): ValidationResult {
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

      // Discord OAuth設定
      result.DISCORD_APPLICATIONID = TYPE_CONVERTERS.string(env.DISCORD_APPLICATIONID)

      // サーバー設定
      result.SERVER_DOMAIN = TYPE_CONVERTERS.string(env.SERVER_DOMAIN, DEFAULT_VALUES.SERVER_DOMAIN)
      result.HOST_DOMAIN = TYPE_CONVERTERS.string(env.HOST_DOMAIN, DEFAULT_VALUES.HOST_DOMAIN)

      // データベース設定
      result.DATABASE_URL = env.DATABASE_URL ? TYPE_CONVERTERS.string(env.DATABASE_URL) : undefined
      result.DB_LOGGING = TYPE_CONVERTERS.boolean(env.DB_LOGGING, DEFAULT_VALUES.DB_LOGGING)

      // 追加のバリデーション
      if (result.PORT) {
        this.validatePort(result.PORT, errors)
      }

      if (result.SERVER_DOMAIN) {
        this.validateUrl(result.SERVER_DOMAIN, 'SERVER_DOMAIN', errors)
      }
      if (result.HOST_DOMAIN) {
        this.validateUrl(result.HOST_DOMAIN, 'HOST_DOMAIN', errors)
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
   * バリデーションエラーを整形して出力
   */
  static formatErrors(errors: ValidationError[]): string {
    return errors
      .map((error) => {
        const value = this.isSensitiveVariable(error.variable) ? '[REDACTED]' : error.value
        return `❌ ${error.variable}: ${error.message}${value ? ` (現在の値: ${value})` : ''}`
      })
      .join('\n')
  }

  private static isSensitiveVariable(variable: string): boolean {
    return /SECRET|TOKEN|PASSWORD|KEY/i.test(variable)
  }
}
