/**
 * Character Edit Feature Module
 *
 * キャラクター編集機能を統合したfeatureモジュール
 * - キャラクターチャンネル作成・初期化
 * - キャラクター情報の追加・編集・変更
 * - モーダル・セレクトメニューによる入力処理
 *
 * Bulletproof React概念に基づく設計:
 * - 単一責任原則の適用
 * - 型安全性の向上
 * - テスタビリティの改善
 * - 関心の分離
 * - NestJSモジュールシステムの活用
 */

// ============================================================================
// NestJS Modules (推奨)
// ============================================================================

export { CharacterEditModule } from './character-edit.module' // Modern Services + Legacy Services (統合)
export { DiscordIntegrationModule } from '../../application/discord-integration.module' // Discord基盤サービス専用モジュール（DiscordIntegrationServiceは廃止済み）

// ============================================================================
// Modern Services (分離されたサービス群)
// ============================================================================

// Re-export all services from the services directory
export * from './services'

// Enhanced Character Edit Service
export { EnhancedCharacterEditService } from './enhanced-character-edit.service'

// ============================================================================
// Legacy Services - Removed (EnhancedCharacterEditServiceに統合済み)
// ============================================================================

// Legacy services have been integrated into EnhancedCharacterEditService
// - CharaInfoButtonService: Integrated into enhanced-character-edit.service.ts
// - AddCharaInfoService: Integrated into enhanced-character-edit.service.ts
// - ChangeCharaInfoService: Integrated into enhanced-character-edit.service.ts

// 注: かつて存在した CharacterEditServiceFactory は、実在しない
// './character-channel-create.service' を require する未使用デッドコードだったため削除（2026-06-03）。
// ChannelDetectionService / CharacterNotificationService は
// './services' から export 済みで、利用は NestJS の DI（CharacterEditModule）を介して行う。
