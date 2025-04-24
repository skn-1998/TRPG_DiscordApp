import { Controller } from '@nestjs/common'
import { DiscordService } from './discord.service'
import { Client } from 'discord.js'
import { CommandsController } from './commands/commands.controller'

/**
 * Discordコントローラー
 */
@Controller('discord')
export class DiscordController {
  constructor(
    private readonly _discordService: DiscordService,
    private readonly commandsController: CommandsController
  ) {
    this.initializeServices()
  }

  /**
   * 関連サービスの初期化
   */
  private initializeServices(): void {
    console.log(`Discord service initialized: ${this._discordService ? 'success' : 'failed'}`)
  }

  handleCommand(client: Client) {
    this.commandsController.handleCommand(client)
  }

  handleAutoComplete(client: Client) {
    this.commandsController.handleAutoComplete(client)
  }
}
