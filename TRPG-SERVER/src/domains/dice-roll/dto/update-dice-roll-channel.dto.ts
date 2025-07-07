/* eslint-disable indent */
import { IsArray, IsOptional, IsString } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'
import { DiceRollChannelInputDto } from './create-dice-roll-channel.dto'

/**
 * ダイスロールチャンネル更新DTO
 */
export class UpdateDiceRollChannelDto extends PartialType(DiceRollChannelInputDto) {}

/**
 * ダイスロールチャンネル出力DTO（軽量データ）
 */
export class DiceRollChannelOutputDto {
  readonly discordChannelId: string
  readonly characterIds?: string[]
  readonly textIds?: string[]
  readonly gameSystemId?: string
  readonly embedId?: string
  readonly createdAt?: Date
  readonly updatedAt?: Date
}
