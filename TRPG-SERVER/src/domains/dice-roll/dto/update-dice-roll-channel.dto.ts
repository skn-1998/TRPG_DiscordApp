import { PartialType } from '@nestjs/mapped-types'
import { DiceRollChannelInputDto } from './create-dice-roll-channel.dto'

/**
 * ダイスロールチャンネル更新DTO
 */
export class UpdateDiceRollChannelDto extends PartialType(DiceRollChannelInputDto) {}
