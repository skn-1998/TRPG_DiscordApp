/* eslint-disable indent */
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { BaseDto, ValidationUtils } from '../../../core/dto/base.dto'

/**
 * ダイスロールチャンネル作成DTO
 */
export class CreateDiceRollChannelDto extends BaseDto {
  @IsString(ValidationUtils.requiredString('Discordチャンネル'))
  @IsNotEmpty()
  readonly discordChannelId: string

  @IsArray(ValidationUtils.array('キャラクターID'))
  @IsString({ each: true })
  @IsOptional()
  readonly characterIds?: string[]

  @IsArray(ValidationUtils.array('テキストID'))
  @IsString({ each: true })
  @IsOptional()
  readonly textIds?: string[]

  @IsString(ValidationUtils.optionalString('ゲームシステムID'))
  @IsOptional()
  readonly gameSystemId?: string
}

/**
 * ダイスロールチャンネル入力DTO（部分入力可能）
 */
export class DiceRollChannelInputDto {
  @IsString(ValidationUtils.requiredString('Discordチャンネル'))
  @IsNotEmpty()
  readonly discordChannelId: string

  @IsArray(ValidationUtils.array('キャラクターID'))
  @IsString({ each: true })
  @IsOptional()
  readonly characterIds?: string[]

  @IsArray(ValidationUtils.array('テキストID'))
  @IsString({ each: true })
  @IsOptional()
  readonly textIds?: string[]

  @IsString(ValidationUtils.optionalString('ゲームシステムID'))
  @IsOptional()
  readonly gameSystemId?: string

  @IsString(ValidationUtils.optionalString('埋め込みID'))
  @IsOptional()
  readonly embedId?: string
}
