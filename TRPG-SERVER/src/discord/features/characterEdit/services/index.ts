/**
 * Character Edit Services
 *
 * Bulletproof React概念に基づく分離されたサービス群
 * - 単一責任原則の適用
 * - 型安全性の向上
 * - テスタビリティの改善
 * - 関心の分離
 * - NestJSの依存性注入システムを活用
 */

// ============================================================================
// Services (NestJSの@Injectable()デコレータ付き)
// ============================================================================

export { ChannelDetectionService } from './channel-detection.service'
export { CharacterCreationService } from './character-creation.service'
export { CharacterNotificationService } from './character-notification.service'
export { ChannelCreateOrchestratorService } from './channel-create-orchestrator.service'
export { CharacterEventIntegrationService } from './character-event-integration.service'

// Enhanced Character Edit Services
export { CharacterEmbedManagerService } from './character-embed-manager.service'
export { CharacterSectionEditorService } from './character-section-editor.service'
export { CharacterModalHandlerService } from './character-modal-handler.service'

// ============================================================================
// Types and Interfaces
// ============================================================================

export { ChannelCreationContext, ChannelCreationResult } from './channel-detection.service'
export { CharacterCreationResult } from './character-creation.service'

// ============================================================================
// Service Usage Guide (NestJS依存性注入の使用方法)
// ============================================================================

/**
 * NestJSでの使用例:
 *
 * ```typescript
 * import { CharacterEditModule } from './character-edit.module'
 *
 * @Module({
 *   imports: [CharacterEditModule],
 *   // ...
 * })
 * export class YourModule {}
 *
 * // サービス内での使用
 * @Injectable()
 * export class YourService {
 *   constructor(
 *     private readonly orchestratorService: ChannelCreateOrchestratorService
 *   ) {}
 *
 *   async handleChannelCreate(channel: TextChannel) {
 *     await this.orchestratorService.execute(channel)
 *   }
 * }
 * ```
 */
