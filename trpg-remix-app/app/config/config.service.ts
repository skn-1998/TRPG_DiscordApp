/**
 * Next.js用型安全な設定サービス
 *
 * ドット記法で設定値にアクセスできるサービスクラス
 *
 * 使用例:
 * ```typescript
 * const configService = new ConfigService()
 *
 * // Discord設定の取得
 * const applicationId = configService.get('discord.applicationId')
 *
 * // API設定
 * const serverDomain = configService.get('server.domain')
 * ```
 */

import { generateAppConfig, AppConfig, ConfigPaths } from './configuration'

export class ConfigService {
  private config: AppConfig

  constructor() {
    this.config = generateAppConfig()
  }

  /**
   * 設定値を取得します
   *
   * IntelliSenseで利用可能な設定パスが表示されます
   *
   * @param path 設定へのパス（ドット記法）例: 'discord.clientId'
   * @returns 設定値
   */
  get<T extends ConfigPaths>(path: T): unknown {
    const keys = path.split('.') as string[]

    let result: unknown = this.config
    for (const key of keys) {
      result = (result as Record<string, unknown>)[key]
    }

    return result
  }

  /**
   * 全設定を取得
   */
  getAll(): AppConfig {
    return this.config
  }

  /**
   * 環境変数の生の値を取得（サーバーサイドのデバッグ用）
   */
  getRaw(key: string): string | undefined {
    if (typeof process === 'undefined' || !process.env) {
      return undefined
    }

    return process.env[key]
  }

  /**
   * 現在の環境を取得
   */
  getEnvironment(): 'development' | 'production' | 'test' {
    return this.config.app.environment
  }

  /**
   * 本番環境かどうかをチェック
   */
  isProduction(): boolean {
    return this.config.app.environment === 'production'
  }

  /**
   * 開発環境かどうかをチェック
   */
  isDevelopment(): boolean {
    return this.config.app.environment === 'development'
  }

  /**
   * テスト環境かどうかをチェック
   */
  isTest(): boolean {
    return this.config.app.environment === 'test'
  }
}

/**
 * シングルトンインスタンス
 */
export const configService = new ConfigService()
