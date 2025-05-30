import { Injectable } from '@nestjs/common'
import { CommandsController } from './commands.controller'
import { Client, REST, Routes } from 'discord.js'
import 'dotenv/config'
import { CharacterThreadService } from './commands-components/character-thread.service'
import { DiceFromContextMenuService } from './commands-components/dice-from-context-menu.service'
import { RollDiceService } from './commands-components/roll-dice.service'
import { SelectGameSystemService } from './commands-components/select-game-system.service'
import { UserDefinedDiceService } from './commands-components/user-defined-dice.service'
import { DiceResultService } from './commands-components/dice-result.service'

@Injectable()
export class CommandsService {
  private characterThreadService: CharacterThreadService
  private rollDiceService: RollDiceService
  private selectGameSystemService: SelectGameSystemService
  private userDefinedDiceService: UserDefinedDiceService
  private diceFromContextMenuService: DiceFromContextMenuService
  private commandsController: CommandsController
  private diceResultService: DiceResultService

  constructor(
    characterThreadService: CharacterThreadService,
    rollDiceService: RollDiceService,
    selectGameSystemService: SelectGameSystemService,
    userDefinedDiceService: UserDefinedDiceService,
    commandsController: CommandsController,
    diceFromContextMenuService: DiceFromContextMenuService,
    diceResultService: DiceResultService
  ) {
    this.characterThreadService = characterThreadService
    this.rollDiceService = rollDiceService
    this.selectGameSystemService = selectGameSystemService
    this.userDefinedDiceService = userDefinedDiceService
    this.diceFromContextMenuService = diceFromContextMenuService
    this.commandsController = commandsController
    this.diceResultService = diceResultService
  }

  /**
   * 登録されているすべてのコマンドを取得
   * @returns コマンドの配列
   */
  getCommands() {
    return [
      this.characterThreadService,
      this.rollDiceService,
      this.selectGameSystemService,
      this.userDefinedDiceService,
      this.diceFromContextMenuService,
      this.diceResultService
    ].filter((service) => service)
  }

  loadClient(client: Client): void {
    this.commandsController.handleCommand(client)
    this.commandsController.handleAutoComplete(client)
  }

  // 重複したコマンド登録処理を削除
  // CommandManagerServiceで一元管理されるため不要
}
