import { Module, forwardRef } from '@nestjs/common'
import { CharacterModule } from 'src/domains/character/character.module'
import { SharedModule } from '../../../shared/shared.module'
import { DiscordIntegrationModule } from '../../application/discord-integration.module'

// Feature Events
import { CharacterEditFeatureHandler } from './events/handlers/character-edit-feature.handler'
import { CharacterEditCreationHandler } from './events/handlers/character-edit-creation.handler'

// Modern Services (分離されたサービス群)
import { ChannelDetectionService } from './services/channel-detection.service'
import { CharacterCreationService } from './services/character-creation.service'
import { CharacterNotificationService } from './services/character-notification.service'
import { ChannelCreateOrchestratorService } from './services/channel-create-orchestrator.service'
import { CharacterEventIntegrationService } from './services/character-event-integration.service'
import { ChannelNameSyncService } from './services/channel-name-sync.service'

// Enhanced Character Edit Services
import { CharacterEmbedManagerService } from './services/character-embed-manager.service'
import { CharacterSectionEditorService } from './services/character-section-editor.service'
import { CharacterModalHandlerService } from './services/character-modal-handler.service'
import { ModalSessionManagerService } from './services/modal-session-manager.service'
import { EnhancedCharacterEditService } from './enhanced-character-edit.service'

// Legacy Services - Removed (EnhancedCharacterEditServiceに統合済み)
// CharaInfoButtonService, AddCharaInfoService, ChangeCharaInfoServiceは
// EnhancedCharacterEditServiceに統合され、完全に置き換えられました

/**
 * Character Edit Feature Module
 *
 * Bulletproof React概念に基づくNestJSモジュール設計:
 * - 単一責任原則の適用
 * - 依存性注入の適切な管理
 * - モジュール間の疎結合
 * - テスタビリティの向上
 * - AppConfigServiceはグローバルモジュールのため、インポート不要
 */
@Module({
  imports: [
    SharedModule, // TypedEventService用
    forwardRef(() => CharacterModule),
    DiscordIntegrationModule // 循環依存解消により安全にインポート可能
    // Note: AppConfigServiceはグローバルモジュールのためインポート不要
  ],
  providers: [
    // ============================================================================
    // Feature Event Handlers
    // ============================================================================
    CharacterEditFeatureHandler,
    CharacterEditCreationHandler,

    // ============================================================================
    // Modern Services (推奨) - Discord依存関係なし
    // ============================================================================
    ChannelDetectionService,
    CharacterCreationService,
    CharacterNotificationService,
    ChannelCreateOrchestratorService,
    CharacterEventIntegrationService,
    ChannelNameSyncService,

    // ============================================================================
    // Enhanced Character Edit Services
    // ============================================================================
    CharacterEmbedManagerService,
    ModalSessionManagerService,
    CharacterSectionEditorService,
    CharacterModalHandlerService,
    EnhancedCharacterEditService

    // ============================================================================
    // Legacy Services - Removed (EnhancedCharacterEditServiceに統合済み)
    // ============================================================================
    // Legacy services have been completely integrated into EnhancedCharacterEditService
  ],
  exports: [
    // ============================================================================
    // Feature Event Handlers Export
    // ============================================================================
    CharacterEditFeatureHandler,
    CharacterEditCreationHandler,

    // ============================================================================
    // Modern Services Export (新しいコードで使用)
    // ============================================================================
    ChannelDetectionService,
    CharacterCreationService,
    CharacterNotificationService,
    ChannelCreateOrchestratorService,
    CharacterEventIntegrationService,
    ChannelNameSyncService,

    // ============================================================================
    // Enhanced Character Edit Services Export
    // ============================================================================
    CharacterEmbedManagerService,
    ModalSessionManagerService,
    CharacterSectionEditorService,
    CharacterModalHandlerService,
    EnhancedCharacterEditService

    // ============================================================================
    // Legacy Services - Removed (EnhancedCharacterEditServiceに統合済み)
    // ============================================================================
    // Legacy services exports are no longer needed as they are integrated into EnhancedCharacterEditService
  ]
})
export class CharacterEditModule {}
