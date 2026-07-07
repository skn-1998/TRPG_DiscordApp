/**
 * Character Edit Feature Events
 *
 * 🎯 目的: characterEdit機能固有のイベント処理
 *
 * 📋 責務:
 * - characterEdit機能のビジネスロジックイベント
 * - 機能固有のイベント契約定義
 * - 機能内部のイベントハンドリング
 * - 機能固有のイベント検証・変換
 *
 * 🚫 対象外:
 * - アプリケーション全体のイベント統合 → Global Events 層
 * - Discord.js インタラクション処理 → Discord Interactions 層
 *
 * 🏗️ 位置づけ:
 * Global Events (/events)
 * ├── Discord Interactions (/discord/interactions)
 * │   └── Discord.js インタラクション処理
 * └── Feature Events (このモジュール)
 *     └── 機能固有のイベント処理
 */

// Feature Event Contracts
// 注: characterEdit.* の契約は E-4a で src/events/contracts/unified-event-contracts.ts へ正式契約化した。
//     旧 character-edit-events.contract.ts（type フィールド付き・利用箇所ゼロの二重管理）は削除済み。

// Feature Event Handlers
export { CharacterEditFeatureHandler } from './handlers/character-edit-feature.handler'

// Legacy CustomId definitions (後方互換性)
export * from './character-edit.ids'
