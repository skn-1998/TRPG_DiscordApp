import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { DiceRollService } from './dice-roll.service'
import { DiceExecutionService } from './services/dice-execution.service'
import { DiceRollChannelRepository } from './repositories/dice-roll-channel.repository'
import { DiceRollTextRepository } from './repositories/dice-roll-text.repository'
import {
  DiceRollChannelSchema,
  DICE_ROLL_CHANNEL_MODEL,
  DICE_ROLL_CHANNEL_COLLECTION
} from './models/dice-roll-channel.model'
import { DiceRollTextSchema, DICE_ROLL_TEXT_MODEL, DICE_ROLL_TEXT_COLLECTION } from './models/dice-roll-text.model'

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DICE_ROLL_CHANNEL_MODEL,
        schema: DiceRollChannelSchema,
        collection: DICE_ROLL_CHANNEL_COLLECTION
      },
      {
        name: DICE_ROLL_TEXT_MODEL,
        schema: DiceRollTextSchema,
        collection: DICE_ROLL_TEXT_COLLECTION
      }
    ])
  ],
  providers: [DiceRollService, DiceExecutionService, DiceRollChannelRepository, DiceRollTextRepository],
  exports: [DiceRollService, DiceExecutionService, DiceRollChannelRepository, DiceRollTextRepository]
})
export class DiceRollModule {}
