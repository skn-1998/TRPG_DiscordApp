import { Module, OnModuleInit } from '@nestjs/common'
import { CharacterModule } from '../../../domains/character/character.module'
import { CharacterSheetModule } from '../../../features/character-sheet/character-sheet.module'
import { InteractionRegistryModule } from '../../interactions/registry/interaction-registry.module'
import { InteractionRegistryService } from '../../interactions/registry/interaction-registry.service'
import { DiceServicesModule } from '../../services/dice/dice-services.module'
import { DiscordIntegrationModule } from '../../application/discord-integration.module'
import { HubDiscordGateway } from './adapters/hub-discord.gateway'
import { HubDiscordViewBuilder } from './adapters/hub-discord-view.builder'
import { HubGroupBrowserNavigationHandler } from './handlers/hub-group-browser-navigation.handler'
import { HubGroupSelectHandler } from './handlers/hub-group-select.handler'
import { HubPanelNavigationHandler } from './handlers/hub-panel-navigation.handler'
import { ResourceDeltaHandler } from './handlers/resource-delta.handler'
import { RollPaletteHandler } from './handlers/roll-palette.handler'
import { HubProjectionService } from './services/hub-projection.service'
import { HubPublicationService } from './services/hub-publication.service'
import { HubRefreshWorker } from './services/hub-refresh.worker'
import { HubThreadEventListener } from './services/hub-thread-event.listener'

@Module({
  imports: [
    CharacterModule,
    CharacterSheetModule,
    DiceServicesModule,
    DiscordIntegrationModule,
    InteractionRegistryModule
  ],
  providers: [
    RollPaletteHandler,
    ResourceDeltaHandler,
    HubGroupSelectHandler,
    HubPanelNavigationHandler,
    HubGroupBrowserNavigationHandler,
    HubDiscordGateway,
    HubDiscordViewBuilder,
    HubProjectionService,
    HubPublicationService,
    HubRefreshWorker,
    HubThreadEventListener
  ]
})
export class CharacterSheetDiscordFeatureModule implements OnModuleInit {
  constructor(
    private readonly interactionRegistry: InteractionRegistryService,
    private readonly rollPaletteHandler: RollPaletteHandler,
    private readonly resourceDeltaHandler: ResourceDeltaHandler,
    private readonly hubGroupSelectHandler: HubGroupSelectHandler,
    private readonly hubPanelNavigationHandler: HubPanelNavigationHandler,
    private readonly hubGroupBrowserNavigationHandler: HubGroupBrowserNavigationHandler,
    private readonly hubPublicationService: HubPublicationService,
    private readonly hubRefreshWorker: HubRefreshWorker
  ) {}

  onModuleInit(): void {
    this.interactionRegistry.registerHandlers([
      this.rollPaletteHandler,
      this.resourceDeltaHandler,
      this.hubGroupSelectHandler,
      this.hubPanelNavigationHandler,
      this.hubGroupBrowserNavigationHandler
    ])
    this.hubPublicationService.connectRefreshWorker(this.hubRefreshWorker)
  }
}
