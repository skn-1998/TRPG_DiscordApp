import { Module } from '@nestjs/common'
// import { CommandsService } from './commands.service'
import { CommandsController } from './commands.controller'
import { CharacterThreadService } from './commands-components/character-thread.service'
import { RollDiceService } from './commands-components/roll-dice.service'
import { SelectGameSystemService } from './commands-components/select-game-system.service'
import { UserDefinedDiceService } from './commands-components/user-defined-dice.service'
import { DiceFromContextMenuService } from './commands-components/dice-from-context-menu.service'
import { CommandsService } from './commands.service'
import { InteractionsModule } from '../interactions/interactions.module'
import { DiceResultService } from './commands-components/dice-result.service'
import { CharacterModule } from '../../domains/character/character.module'
import { GameSystemFeatureModule } from '../features/gameSystem/game-system.module'
import { UserDefinedDiceFeatureModule } from '../features/userDefinedDice/user-defined-dice.module'
import { DiceRollFeatureModule } from '../features/diceRoll/dice-roll.module'
@Module({
  imports: [
    InteractionsModule,
    CharacterModule,
    GameSystemFeatureModule,
    UserDefinedDiceFeatureModule,
    DiceRollFeatureModule
  ],
  providers: [
    CharacterThreadService,
    RollDiceService,
    SelectGameSystemService,
    UserDefinedDiceService,
    DiceFromContextMenuService,
    CommandsService,
    DiceResultService
  ],
  controllers: [CommandsController],
  exports: [CommandsService]
})
export class CommandsModule {}
