import { Injectable } from '@nestjs/common'
import { CommandsController } from './commands.controller'
import { Client, REST, Routes } from 'discord.js'
import 'dotenv/config'
import { CharacterThreadService } from './commands-components/character-thread.service'
import { DiceFromContextMenuService } from './commands-components/dice-from-context-menu.service'
import { RollDiceService } from './commands-components/roll-dice.service'
import { SelectGameSystemService } from './commands-components/select-game-system.service'
import { UserDefinedDiceService } from './commands-components/user-defined-dice.service'

@Injectable()
export class CommandsService {
  private characterThreadService: CharacterThreadService
  private rollDiceService: RollDiceService
  private selectGameSystemService: SelectGameSystemService
  private userDefinedDiceService: UserDefinedDiceService
  private diceFromContextMenuService: DiceFromContextMenuService
  private commandsController: CommandsController

  constructor(
    characterThreadService: CharacterThreadService,
    rollDiceService: RollDiceService,
    selectGameSystemService: SelectGameSystemService,
    userDefinedDiceService: UserDefinedDiceService,
    commandsController: CommandsController,
    diceFromContextMenuService: DiceFromContextMenuService
  ) {
    this.characterThreadService = characterThreadService
    this.rollDiceService = rollDiceService
    this.selectGameSystemService = selectGameSystemService
    this.userDefinedDiceService = userDefinedDiceService
    this.diceFromContextMenuService = diceFromContextMenuService
    this.commandsController = commandsController
  }

  loadClient(client: Client): void {
    this.commandsController.handleCommand(client)
    this.commandsController.handleAutoComplete(client)
  }

  private rest = new REST({ version: '10' }).setToken(process.env.TOKEN || '')
  private APPLICATIONID: string = process.env.DISCORD_APPLICATIONID || ''
  private GUILDID: string = process.env.GUILDID || ''

  async onModuleInit(): Promise<void> {
    const commands = [
      this.characterThreadService.data.toJSON(),
      this.rollDiceService.data.toJSON(),
      this.selectGameSystemService.data.toJSON(),
      this.userDefinedDiceService.data.toJSON(),
      this.diceFromContextMenuService.data.toJSON()
    ]
    try {
      await this.rest.put(
        Routes.applicationGuildCommands(this.APPLICATIONID, this.GUILDID),
        { body: commands }
      )
      console.log('コマンドの登録が完了しました。')
    } catch (error) {
      console.error(error)
    }
  }
}
