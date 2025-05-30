/* eslint-disable indent */
import { IsBIC, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

/**
 * ダイスロールテキスト作成DTO
 */
export class CreateDiceRollTextDto {
  @IsString()
  @IsOptional()
  textId?: string

  @IsString()
  @IsNotEmpty()
  discordChannelId: string

  @IsString()
  @IsOptional()
  characterId?: string

  @IsString()
  @IsNotEmpty()
  result: number

  @IsString()
  @IsNotEmpty()
  diceRoll: string

  @IsString()
  @IsNotEmpty()
  text: string

  @IsBoolean()
  @IsOptional()
  isSecret?: boolean
}

/**
 * 部分的なダイスロールテキスト入力DTO
 */
export class PartialInputDiceRollTextDto {
  @IsString()
  @IsOptional()
  textId?: string

  @IsString()
  @IsNotEmpty()
  discordChannelId: string

  @IsString()
  @IsOptional()
  characterId?: string

  @IsNumber()
  @IsNotEmpty()
  result: number

  @IsString()
  @IsNotEmpty()
  diceRoll: string

  @IsString()
  @IsNotEmpty()
  text: string
}
