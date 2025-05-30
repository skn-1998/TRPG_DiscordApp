import { Module, forwardRef } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { CharaInfoButtonService } from './button/chara-info-button.service'
import { DiceButtonService } from './button/dice-button.service'
import { AddCharaInfoService } from './modal/add-chara-info.service'
import { ChangeCharaInfoService } from './select/change-chara-info.service'
import { CharacterChannelService } from './select/character-channel.service'
import { CharacterModule } from 'src/domains/character/character.module'
import { DiscordModule } from '../discord.module'
import { CharacterTabButtonsService } from './button/character-tab-buttons.service'
import { CharacterDiceButtonsService } from './button/character-dice-buttons.service'
import { ChannelCreateService } from './channel/character-channel-create.service'
import { DiceRollChannelCreateService } from './channel/diceroll-channel-create.service'
import { DiceRollModule } from 'src/domains/dice-roll/dice-roll.module'
import { DiceRollPaginationService } from '../components/pagination/dice-roll-pagination.service'
import { DicePagePrevButtonService } from './button/dice-page-prev-button.service'
import { DicePageNextButtonService } from './button/dice-page-next-button.service'
import { DicePageFirstButtonService } from './button/dice-page-first-button.service'
import { DicePageLastButtonService } from './button/dice-page-last-button.service'
import { DicePageCancelButtonService } from './button/dice-page-cancel-button.service'
import { DiceCharacterSelectService } from './select/dice-character-select.service'
import { DicePageSelectMenuService } from './select-menu/dice-page-select-menu.service'
import { EventEmitterModule } from '@nestjs/event-emitter'

@Module({
  controllers: [EventsController],
  providers: [
    EventsService,
    CharaInfoButtonService,
    DiceButtonService,
    AddCharaInfoService,
    ChangeCharaInfoService,
    CharacterChannelService,
    EventsController,
    CharacterTabButtonsService,
    CharacterDiceButtonsService,
    ChannelCreateService,
    DiceRollChannelCreateService,
    DiceRollPaginationService,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    DicePageSelectMenuService
  ],
  exports: [
    EventsService,
    CharacterChannelService,
    CharaInfoButtonService,
    DiceButtonService,
    AddCharaInfoService,
    ChangeCharaInfoService,
    CharacterTabButtonsService,
    CharacterDiceButtonsService,
    ChannelCreateService,
    DiceRollChannelCreateService,
    DiceRollPaginationService,
    DicePagePrevButtonService,
    DicePageNextButtonService,
    DicePageFirstButtonService,
    DicePageLastButtonService,
    DicePageCancelButtonService,
    DiceCharacterSelectService,
    DicePageSelectMenuService
  ],
  imports: [CharacterModule, forwardRef(() => DiscordModule), DiceRollModule, EventEmitterModule]
})
export class EventsModule {}
