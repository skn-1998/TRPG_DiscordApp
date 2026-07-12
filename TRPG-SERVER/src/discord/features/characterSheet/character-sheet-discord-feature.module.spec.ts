import type { InteractionRegistryService } from '../../interactions/registry/interaction-registry.service'
import { CharacterSheetDiscordFeatureModule } from './character-sheet-discord-feature.module'
import type { ResourceDeltaHandler } from './handlers/resource-delta.handler'
import type { RollPaletteHandler } from './handlers/roll-palette.handler'

describe('CharacterSheetDiscordFeatureModule', () => {
  it('onModuleInit で2 handlerを明示登録する', () => {
    const registry = { registerHandlers: jest.fn() }
    const rollPaletteHandler = {} as RollPaletteHandler
    const resourceDeltaHandler = {} as ResourceDeltaHandler
    const featureModule = new CharacterSheetDiscordFeatureModule(
      registry as unknown as InteractionRegistryService,
      rollPaletteHandler,
      resourceDeltaHandler
    )

    featureModule.onModuleInit()

    expect(registry.registerHandlers).toHaveBeenCalledWith([rollPaletteHandler, resourceDeltaHandler])
  })
})
