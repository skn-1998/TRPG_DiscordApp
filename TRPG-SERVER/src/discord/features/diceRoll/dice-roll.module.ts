import { Module } from '@nestjs/common'
import { RollDiceOrchestrator } from './services/roll-dice.orchestrator'
import { DiceResultOrchestrator } from './services/dice-result.orchestrator'
import { EventsModule } from '../../events/events.module'
import { DicePagePrevButtonService } from './adapters/dice-page-prev-button.adapter'
import { DicePageNextButtonService } from './adapters/dice-page-next-button.adapter'
import { DicePageSelectMenuService } from './adapters/dice-page-select-menu.adapter'
import { DicePageFirstButtonService } from './adapters/dice-page-first-button.adapter'
import { DicePageLastButtonService } from './adapters/dice-page-last-button.adapter'
import { DicePageCancelButtonService } from './adapters/dice-page-cancel-button.adapter'
import { DiceCharacterSelectService } from './adapters/dice-character-select.adapter'
import { CustomDiceModalService } from './adapters/custom-dice-modal.adapter'
import { DiceButtonService } from './adapters/dice-button.adapter'

@Module({
  imports: [EventsModule],
  providers: [
    RollDiceOrchestrator,
    DiceResultOrchestrator,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageSelectMenuService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    CustomDiceModalService,
    DiceButtonService
  ],
  exports: [
    RollDiceOrchestrator,
    DiceResultOrchestrator,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageSelectMenuService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    CustomDiceModalService,
    DiceButtonService
  ]
})
export class DiceRollFeatureModule {}
