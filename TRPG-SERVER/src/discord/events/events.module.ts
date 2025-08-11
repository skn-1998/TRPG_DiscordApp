import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { CharacterDiceButtonsService } from './button/character-dice-buttons.service'
import { DiceRollChannelCreateService } from './channel/diceroll-channel-create.service'
import { CharacterChannelCreateService } from './channel/character-channel-create.service'
import { DiceRollModule } from 'src/domains/dice-roll/dice-roll.module'
import { DiceRollPaginationService } from '../components/pagination/dice-roll-pagination.service'
import { DicePagePrevButtonService } from '../features/diceRoll/adapters/dice-page-prev-button.adapter'
import { DicePageNextButtonService } from '../features/diceRoll/adapters/dice-page-next-button.adapter'
import { DicePageSelectMenuService } from '../features/diceRoll/adapters/dice-page-select-menu.adapter'
import { CharacterThreadSelectService } from './select/character-thread-select.service'
import { DicePageFirstButtonService } from '../features/diceRoll/adapters/dice-page-first-button.adapter'
import { DicePageLastButtonService } from '../features/diceRoll/adapters/dice-page-last-button.adapter'
import { DicePageCancelButtonService } from '../features/diceRoll/adapters/dice-page-cancel-button.adapter'
import { DiceCharacterSelectService } from '../features/diceRoll/adapters/dice-character-select.adapter'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { DiceButtonService } from '../features/diceRoll/adapters/dice-button.adapter'
import { SharedModule } from '../../shared/shared.module'
import { CharacterThreadFeatureModule } from '../features/characterThread/character-thread-feature.module'

// Character Edit Modules
import { CharacterEditModule } from '../features/characterEdit/character-edit.module'

@Module({
  controllers: [EventsController],
  providers: [
    EventsService,
    DiceButtonService,
    EventsController,
    CharacterDiceButtonsService,
    DiceRollChannelCreateService,
    CharacterChannelCreateService,
    DiceRollPaginationService,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    CharacterThreadSelectService,
    DicePageSelectMenuService
  ],
  exports: [
    EventsService,
    DiceButtonService,
    CharacterDiceButtonsService,
    DiceRollChannelCreateService,
    CharacterChannelCreateService,
    DiceRollPaginationService,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    CharacterThreadSelectService,
    DicePageSelectMenuService
  ],
  imports: [
    DiceRollModule,
    EventEmitterModule,
    CharacterEditModule, // Modern Services + Legacy Services (統合)
    SharedModule, // TypedEventService用
    CharacterThreadFeatureModule
  ]
})
export class EventsModule {}
