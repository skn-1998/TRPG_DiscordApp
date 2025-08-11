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
export { DiscordIntegrationModule } from '../../application/discord-integration.module' // DiscordIntegrationService専用モジュール

// ============================================================================
// Modern Services (分離されたサービス群)
// ============================================================================

// Re-export all services from the services directory
export * from './services'

// Enhanced Character Edit Service
export { EnhancedCharacterEditService } from './enhanced-character-edit.service'

// Import types for internal use
import { ChannelCreationContext, CharacterCreationResult } from './services'

// ============================================================================
// Legacy Services (後方互換性のため)
// ============================================================================

export { CharaInfoButtonService } from './chara-info-button.service'
export { AddCharaInfoService } from './add-chara-info.service'
export { ChangeCharaInfoService } from './change-chara-info.service'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CharacterEditContext {
  channelId: string
  userId: string
  guildId: string
}

export interface CharacterUpdatePayload {
  field: 'status' | 'parameter' | 'skill'
  data: Record<string, any>
  context: CharacterEditContext
}

// Configuration
export const CHARACTER_EDIT_CONFIG = {
  MAX_INPUT_LENGTH: 2000,
  AUTO_DELETE_ERROR_TIMEOUT: 5000,
  SUPPORTED_FIELDS: ['status', 'parameter', 'skill'] as const,
  // リファクタリングで追加された設定
  AUDIT_LOG_LIMIT: 10,
  DEFAULT_GAME_SYSTEM_ID: '',
  NOTIFICATION_TIMEOUT: 30000
} as const

// Validation utilities
export class CharacterEditValidator {
  static isValidField(field: string): field is (typeof CHARACTER_EDIT_CONFIG.SUPPORTED_FIELDS)[number] {
    return CHARACTER_EDIT_CONFIG.SUPPORTED_FIELDS.includes(field as any)
  }

  static validateInput(input: string): boolean {
    return input.length > 0 && input.length <= CHARACTER_EDIT_CONFIG.MAX_INPUT_LENGTH
  }

  // リファクタリングで追加されたバリデーション
  static validateChannelContext(context: ChannelCreationContext): boolean {
    return !!(context.channel && context.categoryId && context.channel.id)
  }

  static validateCharacterCreationResult(result: CharacterCreationResult): boolean {
    if (!result.success) return false
    return !!(result.characterId && result.characterName)
  }
}

// Service Factory (Bulletproof React概念に基づく)
export class CharacterEditServiceFactory {
  static createChannelDetectionService(appConfigService: any) {
    return new (require('./character-channel-create.service').ChannelDetectionService)(appConfigService)
  }

  static createCharacterCreationService(characterService: any) {
    return new (require('./character-channel-create.service').CharacterCreationService)(characterService)
  }

  static createCharacterNotificationService(changeCharaInfoService: any) {
    return new (require('./character-channel-create.service').CharacterNotificationService)(changeCharaInfoService)
  }
}
