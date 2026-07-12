import { Module, OnModuleInit } from '@nestjs/common'
import { CharacterModule } from '../../../domains/character/character.module'
import { CharacterSheetModule } from '../../../features/character-sheet/character-sheet.module'
import { InteractionRegistryModule } from '../../interactions/registry/interaction-registry.module'
import { InteractionRegistryService } from '../../interactions/registry/interaction-registry.service'
import { DiceServicesModule } from '../../services/dice/dice-services.module'
import { ResourceDeltaHandler } from './handlers/resource-delta.handler'
import { RollPaletteHandler } from './handlers/roll-palette.handler'

@Module({
  imports: [CharacterModule, CharacterSheetModule, DiceServicesModule, InteractionRegistryModule],
  providers: [RollPaletteHandler, ResourceDeltaHandler]
})
export class CharacterSheetDiscordFeatureModule implements OnModuleInit {
  constructor(
    private readonly interactionRegistry: InteractionRegistryService,
    private readonly rollPaletteHandler: RollPaletteHandler,
    private readonly resourceDeltaHandler: ResourceDeltaHandler
  ) {}

  onModuleInit(): void {
    this.interactionRegistry.registerHandlers([this.rollPaletteHandler, this.resourceDeltaHandler])
  }
}
