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
 * // string型が推論される
 * const dbHost = this.appConfigService.get('database.mongoUri');
 *
 * // Discord設定の取得
 * const token = this.appConfigService.get('discord.token');
 * ```
 */
@Injectable()
export class AppConfigService extends ConfigService<AppConfig, true> {
  /**
   * 設定値を取得します
   *
   * @param path 設定へのパス（ドット記法）
   * @returns 設定値（型安全）
   */
  // eslint-disable-next-line no-use-before-define
  get<P extends Path<T>, T = AppConfig>(path: P): PathValue<T, P> {
    // infer: true を常に適用することで、型推論を有効にする
    return super.get<T, P, PathValue<T, P>>(path, { infer: true })
  }

  /**
   * 環境変数の生の値を取得（デバッグ用）
   * 通常は get() メソッドを使用することを推奨
   */
  getRaw(key: string): string | undefined {
    return process.env[key]
  }
}
