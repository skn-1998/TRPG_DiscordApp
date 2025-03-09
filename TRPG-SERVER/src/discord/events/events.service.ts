import { Injectable, OnModuleInit } from '@nestjs/common'
import { CharaInfoButtonService } from './button/chara-info-button.service'
import { DiceButtonService } from './button/dice-button.service'
import { Client, REST, Routes } from 'discord.js'
import { ChangeCharaInfoService } from './select/change-chara-info.service'
import { CharacterChannelService } from './select/character-channel.service'
import { AddCharaInfoService } from './modal/add-chara-info.service'
import { EventsController } from './events.controller'

@Injectable()
export class EventsService {
  constructor(
    // private charaInfoButtonService: CharaInfoButtonService,
    // private diceButtonService: DiceButtonService,
    // private addCharaInfoService: AddCharaInfoService,
    // private changeCharaInfoService: ChangeCharaInfoService,
    // private characterChannelService: CharacterChannelService,
    private eventsController: EventsController
  ) {}

  loadClient(client: Client) {
    this.eventsController.handleCommand(client)
  }
}
