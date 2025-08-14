import { Module, forwardRef } from '@nestjs/common'
import { CharacterModule } from 'src/domains/character/character.module'
import { SharedModule } from '../../../shared/shared.module'
import { DiscordIntegrationModule } from '../../application/discord-integration.module'

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

// Legacy Services (後方互換性のため)
import { CharaInfoButtonService } from './chara-info-button.service'
import { AddCharaInfoService } from './add-chara-info.service'
import { ChangeCharaInfoService } from './change-chara-info.service'

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
    DiscordIntegrationModule // Discord依存関係があるLegacy Services用
    // Note: AppConfigServiceはグローバルモジュールのためインポート不要
  ],
  providers: [
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
    EnhancedCharacterEditService,

    // ============================================================================
    // Legacy Services (後方互換性のため) - Discord依存関係あり
    // ============================================================================
    CharaInfoButtonService,
    AddCharaInfoService,
    ChangeCharaInfoService
  ],
  exports: [
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
    EnhancedCharacterEditService,

    // ============================================================================
    // Legacy Services Export (後方互換性のため)
    // ============================================================================
    CharaInfoButtonService,
    AddCharaInfoService,
    ChangeCharaInfoService
  ]
})
export class CharacterEditModule {}
