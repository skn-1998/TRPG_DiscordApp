import { Injectable } from '@nestjs/common';
import { ConfigService, Path, PathValue } from '@nestjs/config';

import { AppConfig } from './configuration';

/**
 * 型安全な設定サービス
 * 
 * 通常のConfigServiceを拡張し、型安全にドット記法で設定値にアクセスできるようにしています。
 * 使用例:
 * ```typescript
 * // string型が推論される
 * const dbHost = this.appConfigService.get('database.mongoUri');
 * ```
 */
@Injectable()
export class AppConfigService extends ConfigService<AppConfig, true> {
  /**
   * 設定値を取得します
   * 
   * @param path 設定へのパス（ドット記法）
   * @returns 設定値
   */
  // eslint-disable-next-line no-use-before-define
  get<P extends Path<T>, T = AppConfig>(path: P): PathValue<T, P> {
    // infer: true を常に適用することで、型推論を有効にする
    return super.get<T, P, PathValue<T, P>>(path, { infer: true });
  }
} 