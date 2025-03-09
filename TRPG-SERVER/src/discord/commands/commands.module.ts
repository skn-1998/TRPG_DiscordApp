import { Module } from '@nestjs/common'
// import { CommandsService } from './commands.service'
import { CommandsController } from './commands.controller'
import { CharacterThreadService } from './commands-components/character-thread.service'
import { RollDiceService } from './commands-components/roll-dice.service'
import { SelectGameSystemService } from './commands-components/select-game-system.service'
import { UserDefinedDiceService } from './commands-components/user-defined-dice.service'
import { DiceFromContextMenuService } from './commands-components/dice-from-context-menu.service'
import { CommandsService } from './commands.service'

@Module({
  providers: [
    CharacterThreadService,
    RollDiceService,
    SelectGameSystemService,
    UserDefinedDiceService,
    DiceFromContextMenuService,
    CommandsController,
    CommandsService
  ],
  controllers: [CommandsController],
  exports: [CommandsService]
})
export class CommandsModule {}
