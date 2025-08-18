/**
 * 型定義の統一エクスポート
 * AI.architecture.mdの設計方針に基づくモジュラー型定義の中央管理
 */

// Discord関連型
export * from './discord.types'

// Character関連型
export * from './character.types'

// Events関連型
export * from './events.types'

// 既存の型定義との互換性
export { AttributeSection, AttributeValue, AttributeNumberParts } from '../core/types/attribute.types'

// 型エイリアスと型ガード関数は一時的にコメントアウト
// 基本的なエクスポートのみで動作確認

/**
 * 型定義バージョン情報
 * 型定義の進化を管理
 */
export const TypeDefinitionInfo = {
  version: '1.0.0',
  lastUpdated: '2025-08-17',
  strategy: 'modular-namespaced',
  features: [
    'Namespace-based type organization',
    'Concrete types for any elimination',
    'Type guards and converters',
    'Backward compatibility',
    'Centralized export management'
  ]
} as const
