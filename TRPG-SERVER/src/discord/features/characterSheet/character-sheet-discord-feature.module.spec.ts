import type { InteractionRegistryService } from '../../interactions/registry/interaction-registry.service'
import { CharacterSheetDiscordFeatureModule } from './character-sheet-discord-feature.module'
import type { ResourceDeltaHandler } from './handlers/resource-delta.handler'
import type { RollPaletteHandler } from './handlers/roll-palette.handler'
import type { HubGroupSelectHandler } from './handlers/hub-group-select.handler'
import type { HubPanelNavigationHandler } from './handlers/hub-panel-navigation.handler'
import type { HubGroupBrowserNavigationHandler } from './handlers/hub-group-browser-navigation.handler'
import type { HubPublicationService } from './services/hub-publication.service'
import type { HubRefreshWorker } from './services/hub-refresh.worker'

describe('CharacterSheetDiscordFeatureModule', () => {
  it('onModuleInit で5 handlerを明示登録する', () => {
    const registry = { registerHandlers: jest.fn() }
    const rollPaletteHandler = {} as RollPaletteHandler
    const resourceDeltaHandler = {} as ResourceDeltaHandler
    const hubGroupSelectHandler = {} as HubGroupSelectHandler
    const hubPanelNavigationHandler = {} as HubPanelNavigationHandler
    const hubGroupBrowserNavigationHandler = {} as HubGroupBrowserNavigationHandler
    const publication = { connectRefreshWorker: jest.fn() } as unknown as HubPublicationService
    const worker = {} as HubRefreshWorker
    const featureModule = new CharacterSheetDiscordFeatureModule(
      registry as unknown as InteractionRegistryService,
      rollPaletteHandler,
      resourceDeltaHandler,
      hubGroupSelectHandler,
      hubPanelNavigationHandler,
      hubGroupBrowserNavigationHandler,
      publication,
      worker
    )

    featureModule.onModuleInit()

    expect(registry.registerHandlers).toHaveBeenCalledWith([
      rollPaletteHandler,
      resourceDeltaHandler,
      hubGroupSelectHandler,
      hubPanelNavigationHandler,
      hubGroupBrowserNavigationHandler
    ])
    expect(publication.connectRefreshWorker).toHaveBeenCalledWith(worker)
  })
})
