import { Module } from '@nestjs/common'
import { UserDefinedDiceOrchestrator } from './services/user-defined-dice.orchestrator'
import { GameSystemFeatureModule } from '../gameSystem/game-system.module'

@Module({
  imports: [GameSystemFeatureModule],
  providers: [UserDefinedDiceOrchestrator],
  exports: [UserDefinedDiceOrchestrator]
})
export class UserDefinedDiceFeatureModule {}
