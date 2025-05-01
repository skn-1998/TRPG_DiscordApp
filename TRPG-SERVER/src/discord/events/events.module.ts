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
    DiceRollChannelCreateService
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
    DiceRollChannelCreateService
  ],
  imports: [CharacterModule, forwardRef(() => DiscordModule), DiceRollModule]
})
export class EventsModule {}
