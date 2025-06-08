/* eslint-disable indent */
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'

/**
 * ダイスロールチャンネル作成DTO
 */
export class CreateDiceRollChannelDto {
  @IsString()
  @IsNotEmpty()
  discordChannelId: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  characterIds?: string[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  textIds?: string[]

  @IsString()
  @IsOptional()
  gameSystemId?: string
}
/**
 * 部分的なダイスロールチャンネル入力DTO
 */
export class PartialInputDiceRollChannelDto {
  @IsString()
  @IsNotEmpty()
  discordChannelId: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  characterIds?: string[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  textIds?: string[]

  @IsString()
  @IsOptional()
  gameSystemId?: string

  @IsString()
  @IsOptional()
  embedId?: string
}
