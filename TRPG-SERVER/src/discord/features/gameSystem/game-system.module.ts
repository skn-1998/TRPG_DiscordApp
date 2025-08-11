import { Module } from '@nestjs/common'
import { SelectGameSystemOrchestrator } from './services/select-game-system.orchestrator'

@Module({
  providers: [SelectGameSystemOrchestrator],
  exports: [SelectGameSystemOrchestrator]
})
export class GameSystemFeatureModule {}
