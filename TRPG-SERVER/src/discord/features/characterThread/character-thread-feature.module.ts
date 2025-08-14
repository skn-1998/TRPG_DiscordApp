import { Module } from '@nestjs/common'
import { CharacterModule } from 'src/domains/character/character.module'
import { DiscordIntegrationModule } from '../../application/discord-integration.module'
import { ThreadCreationService } from './services/thread-creation.service'
import { CharacterThreadOrchestrator } from './services/character-thread.orchestrator'
import { CharacterDisplayService } from './services/character-display.service'
import { CharacterChannelService } from './character-channel.service'
import { CharacterTabButtonsService } from './character-tab-buttons.service'
import { CharacterDisplayHandlerService } from './services/character-display-handler.service'
import { SharedModule } from '../../../shared/shared.module'

@Module({
  imports: [CharacterModule, DiscordIntegrationModule, SharedModule],
  providers: [
    ThreadCreationService,
    CharacterThreadOrchestrator,
    CharacterDisplayService, // CharacterTabButtonsServiceより先に定義
    CharacterDisplayHandlerService,
    CharacterChannelService,
    CharacterTabButtonsService
  ],
  exports: [
    ThreadCreationService,
    CharacterThreadOrchestrator,
    CharacterDisplayService,
    CharacterDisplayHandlerService,
    CharacterChannelService,
    CharacterTabButtonsService
  ]
})
export class CharacterThreadFeatureModule {}
