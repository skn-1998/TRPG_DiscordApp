import { Module, forwardRef } from '@nestjs/common'
import { CharacterModule } from '../../../domains/character/character.module'
import { DiscordIntegrationModule } from '../../application/discord-integration.module'
import { ThreadCreationService } from './services/thread-creation.service'
import { CharacterThreadOrchestrator } from './services/character-thread.orchestrator'
import { CharacterDisplayService } from './services/character-display.service'
import { CharacterChannelService } from './character-channel.service'
import { CharacterTabButtonsService } from './character-tab-buttons.service'
import { CharacterDisplayHandlerService } from './services/character-display-handler.service'
import { SharedModule } from '../../../shared/shared.module'
// 新しい分割サービス
import { ChannelManagerService } from './services/channel-manager.service'
import { DiceUIBuilderService } from './services/dice-ui-builder.service'
import { CharacterChannelOrchestratorService } from './services/character-channel-orchestrator.service'
import { CharacterEmbedService } from './services/character-embed.service'
import { ThreadOrchestratorService } from './services/thread-orchestrator.service'
import { ThreadManagerService } from './services/thread-manager.service'
import { ThreadInteractionService } from './services/thread-interaction.service'

@Module({
  imports: [CharacterModule, SharedModule, forwardRef(() => DiscordIntegrationModule)],
  providers: [
    ThreadCreationService,
    CharacterThreadOrchestrator,
    CharacterDisplayService, // CharacterTabButtonsServiceより先に定義
    CharacterDisplayHandlerService,
    CharacterChannelService,
    CharacterTabButtonsService,
    // 新しい分割サービス
    ChannelManagerService,
    DiceUIBuilderService,
    CharacterChannelOrchestratorService,
    CharacterEmbedService,
    ThreadOrchestratorService,
    ThreadManagerService,
    ThreadInteractionService
  ],
  exports: [
    ThreadCreationService,
    CharacterThreadOrchestrator,
    CharacterDisplayService,
    CharacterDisplayHandlerService,
    CharacterChannelService,
    CharacterTabButtonsService,
    // 新しい分割サービス
    ChannelManagerService,
    DiceUIBuilderService,
    CharacterChannelOrchestratorService,
    CharacterEmbedService,
    ThreadOrchestratorService,
    ThreadManagerService,
    ThreadInteractionService
  ]
})
export class CharacterThreadFeatureModule {}
