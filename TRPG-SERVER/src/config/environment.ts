/**
 * 環境変数の型定義と検証ユーティリティー
 * アプリケーションが必要とする環境変数の一元管理を行う
 *
 * ⚠️ このファイルは非推奨です
 * 新しいコードでは以下を使用してください:
 * - schemas/environment.schema.ts
 * - environment.validator.ts
 */

import { EnvironmentValidator } from './environment.validator'

// 後方互換性のために残しているが、新しいシステムを使用することを推奨
export { EnvironmentSchema as EnvironmentVariables } from './schemas/environment.schema'
export { EnvironmentValidator } from './environment.validator'

/**
 * @deprecated 新しい EnvironmentValidator.validate() を使用してください
 */
export function getEnvironmentVariables() {
  console.warn('⚠️ getEnvironmentVariables() は非推奨です。EnvironmentValidator.validate() を使用してください。')

  const validation = EnvironmentValidator.validate()

  if (!validation.success) {
    throw new Error(`環境変数の検証に失敗しました: ${EnvironmentValidator.formatErrors(validation.errors!)}`)
  }

  return validation.data!
}

/**
 * @deprecated 新しい EnvironmentValidator.validate() を使用してください
 */
export const env = getEnvironmentVariables()
