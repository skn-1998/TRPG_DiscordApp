import { Injectable } from '@nestjs/common'
import { ConfigService, Path, PathValue } from '@nestjs/config'

import { AppConfig } from './configuration'

/**
 * 型安全な設定サービス
 *
 * 通常のConfigServiceを拡張し、型安全にドット記法で設定値にアクセスできるようにしています。
 *
 * 新しい環境変数バリデーションシステムと統合されており、
 * 起動時に環境変数の検証が行われます。
 *
 * 使用例:
 * ```typescript
 * // string型が推論される - IntelliSenseで候補が表示されます
 * const dbHost = this.appConfigService.get('database.mongoUri');
 *
 * // Discord設定の取得
 * const token = this.appConfigService.get('discord.token');
 * const appId = this.appConfigService.get('discord.applicationId');
 *
 * // アプリケーション設定
 * const frontendUrl = this.appConfigService.get('app.frontendUrl');
 * const port = this.appConfigService.get('app.port');
 *
 * // 認証設定
 * const jwtSecret = this.appConfigService.get('auth.jwtSecret');
 * const redirectUrl = this.appConfigService.get('auth.redirectUrl');
 * ```
 *
 * 利用可能な設定パス:
 * - app.environment | app.port | app.frontendUrl
 * - database.mongoUri | database.logging
 * - discord.token | discord.applicationId | discord.secret | discord.guildId | discord.characterCategory | discord.diceRollCategory
 * - auth.jwtSecret | auth.jwtExpiresIn | auth.redirectUrl
 */
@Injectable()
export class AppConfigService extends ConfigService<AppConfig, true> {
  /**
   * 設定値を取得します
   *
   * IntelliSenseで利用可能な設定パスが表示されます
   *
   * @param path 設定へのパス（ドット記法）例: 'discord.applicationId'
   * @returns 設定値（型安全）
   */
  get<P extends Path<AppConfig>>(path: P): PathValue<AppConfig, P> {
    // infer: true を常に適用することで、型推論を有効にする
    return super.get<AppConfig, P, PathValue<AppConfig, P>>(path, { infer: true })
  }

  /**
   * 環境変数の生の値を取得（デバッグ用）
   * 通常は get() メソッドを使用することを推奨
   */
  getRaw(key: string): string | undefined {
    return process.env[key]
  }
}
