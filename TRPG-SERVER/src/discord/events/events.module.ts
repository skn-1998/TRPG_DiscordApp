import { forwardRef, Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { CharaInfoButtonService } from './button/chara-info-button.service'
import { DiceButtonService } from './button/dice-button.service'
import { AddCharaInfoService } from './modal/add-chara-info.service'
import { ChangeCharaInfoService } from './select/change-chara-info.service'
import { CharacterChannelService } from './select/character-channel.service'
import { CharacterModule } from 'src/DB/character/character.module'

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
  ],
  exports:[
    EventsService
  ],
  imports:[
    CharacterModule
  ],

})
export class EventsModule {}
