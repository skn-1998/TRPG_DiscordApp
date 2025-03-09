import { Controller } from '@nestjs/common'
import { DiscordService } from './discord.service'
import { Client, Interaction } from 'discord.js'
import { CommandsController } from './commands/commands.controller'

@Controller('discord')
export class DiscordController {
  constructor(
    private readonly discordService: DiscordService,
    private readonly commandsController: CommandsController
  ) {}

  handleCommand(client: Client) {
    this.commandsController.handleCommand(client)
  }

  handleAutoComplete(client: Client) {
    this.commandsController.handleAutoComplete(client)
  }
}
