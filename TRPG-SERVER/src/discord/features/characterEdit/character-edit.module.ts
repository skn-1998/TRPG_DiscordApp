import { Module, OnModuleInit } from '@nestjs/common'
import { CharacterModule } from '../../../domains/character/character.module'
import { DiscordIntegrationModule } from '../../application/discord-integration.module'

// Feature Events
import { CharacterEditFeatureHandler } from './events/handlers/character-edit-feature.handler'

// Modern Services (分離されたサービス群)
import { ChannelDetectionService } from './services/channel-detection.service'
import { CharacterCreationService } from './services/character-creation.service'
import { CharacterNotificationService } from './services/character-notification.service'
import { ChannelCreateOrchestratorService } from './services/channel-create-orchestrator.service'
import { CharacterEditChannelCreateListenerService } from './services/character-edit-channel-create-listener.service'
import { CharacterEventIntegrationService } from './services/character-event-integration.service'

// Enhanced Character Edit Services
import { CharacterEmbedManagerService } from './services/character-embed-manager.service'
import { CharacterSectionEditorService } from './services/character-section-editor.service'
import { CharacterModalHandlerService } from './services/character-modal-handler.service'
import { ModalSessionManagerService } from './services/modal-session-manager.service'
import { EnhancedCharacterEditService } from './enhanced-character-edit.service'
import { CharacterEditEventEmitterService } from './services/character-edit-event-emitter.service'
import { CharacterEditMessageUpdaterService } from './services/character-edit-message-updater.service'
import { CharacterUIService } from './services/character-ui.service'

// 🆕 Interaction Registry & Handlers（interactions core から feature 所有へ移管・§8）
import { InteractionRegistryModule } from '../../interactions/registry/interaction-registry.module'
import { InteractionRegistryService } from '../../interactions/registry/interaction-registry.service'
import { CharacterEditRefreshHandler } from './handlers/character-edit-refresh.handler'
import { CharacterEditCreateHandler } from './handlers/character-edit-create.handler'
import { CharacterEditCompactHandler } from './handlers/character-edit-compact.handler'
import { CharacterEditSectionHandler } from './handlers/character-edit-section.handler'
import { CharacterEditFieldHandler } from './handlers/character-edit-field.handler'
import { CharacterEditModalHandler } from './handlers/character-edit-modal.handler'

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
    CharacterModule, // CharacterModule は characterEdit を import しない＝循環なしのため forwardRef 不要（P1-B）
    DiscordIntegrationModule, // 循環依存解消により安全にインポート可能
    InteractionRegistryModule // diceRoll と同様、feature が自 handler を registry 登録するため
    // Note: AppConfigServiceはグローバルモジュールのためインポート不要
  ],
  providers: [
    // ============================================================================
    // Feature Event Handlers
    // ============================================================================
    CharacterEditFeatureHandler,

    // ============================================================================
    // Modern Services (推奨) - Discord依存関係なし
    // ============================================================================
    ChannelDetectionService,
    CharacterCreationService,
    CharacterNotificationService,
    ChannelCreateOrchestratorService,
    // ChannelCreate リスナー（旧 InteractionsService.handleChannelCreate を feature へ移管・§8）
    // OnModuleInit で DiscordClientService.on(ChannelCreate) に自己登録するため exports は不要。
    CharacterEditChannelCreateListenerService,
    CharacterEventIntegrationService,

    // ============================================================================
    // Enhanced Character Edit Services
    // ============================================================================
    CharacterEmbedManagerService,
    ModalSessionManagerService,
    CharacterSectionEditorService,
    CharacterModalHandlerService,
    CharacterEditEventEmitterService,
    CharacterEditMessageUpdaterService,
    EnhancedCharacterEditService,
    CharacterUIService,

    // ============================================================================
    // 🆕 Interaction Handlers（registry 登録対象・interactions core から移管）
    // ============================================================================
    CharacterEditRefreshHandler,
    CharacterEditCreateHandler,
    CharacterEditCompactHandler,
    CharacterEditSectionHandler,
    CharacterEditFieldHandler,
    CharacterEditModalHandler
  ],
  exports: [
    // ============================================================================
    // Feature Event Handlers Export
    // ============================================================================
    CharacterEditFeatureHandler,

    // ============================================================================
    // Modern Services Export (新しいコードで使用)
    // ============================================================================
    ChannelDetectionService,
    CharacterCreationService,
    CharacterNotificationService,
    ChannelCreateOrchestratorService,
    CharacterEventIntegrationService,

    // ============================================================================
    // Enhanced Character Edit Services Export
    // ============================================================================
    CharacterEmbedManagerService,
    ModalSessionManagerService,
    CharacterSectionEditorService,
    CharacterModalHandlerService,
    EnhancedCharacterEditService,
    CharacterUIService

    // ============================================================================
    // Legacy Services - Removed (EnhancedCharacterEditServiceに統合済み)
    // ============================================================================
    // Legacy services exports are no longer needed as they are integrated into EnhancedCharacterEditService
  ]
})
export class CharacterEditModule implements OnModuleInit {
  constructor(
    private readonly interactionRegistry: InteractionRegistryService,
    private readonly characterEditRefreshHandler: CharacterEditRefreshHandler,
    private readonly characterEditCreateHandler: CharacterEditCreateHandler,
    private readonly characterEditCompactHandler: CharacterEditCompactHandler,
    private readonly characterEditSectionHandler: CharacterEditSectionHandler,
    private readonly characterEditFieldHandler: CharacterEditFieldHandler,
    private readonly characterEditModalHandler: CharacterEditModalHandler
  ) {}

  /**
   * モジュール初期化時に characterEdit handler を Registry へ登録する。
   * （旧: InteractionsModule.onModuleInit で集中登録していたものを feature 側へ移管・§8）
   */
  onModuleInit(): void {
    this.interactionRegistry.registerHandlers([
      this.characterEditRefreshHandler,
      this.characterEditCreateHandler,
      this.characterEditCompactHandler,
      this.characterEditSectionHandler,
      this.characterEditFieldHandler,
      this.characterEditModalHandler
    ])
  }
}
