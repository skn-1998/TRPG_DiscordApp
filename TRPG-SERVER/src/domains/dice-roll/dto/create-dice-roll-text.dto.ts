/* eslint-disable indent */
import { IsBoolean, IsOptional, IsString } from 'class-validator'
import { BaseDto, ValidationUtils } from '../../../core/dto/base.dto'

/**
 * ダイスロールテキスト作成DTO
 */
export class CreateDiceRollTextDto extends BaseDto {
  @IsString(ValidationUtils.optionalString('テキストID'))
  @IsOptional()
  readonly textId?: string

  @IsString(ValidationUtils.requiredString('Discordチャンネル'))
  readonly discordChannelId: string

  @IsString(ValidationUtils.optionalString('キャラクターID'))
  @IsOptional()
  readonly characterId?: string

  @IsString(ValidationUtils.optionalString('ダイスロール'))
  @IsOptional()
  readonly diceRoll?: string

  @IsString(ValidationUtils.optionalString('テキスト'))
  @IsOptional()
  readonly text?: string

  @IsString(ValidationUtils.optionalString('結果'))
  @IsOptional()
  readonly result?: string

  @IsBoolean()
  @IsOptional()
  readonly isSecret?: boolean
}

/**
 * ダイスロールテキスト入力DTO（部分入力可能）
 */
export class DiceRollTextInputDto {
  @IsString(ValidationUtils.optionalString('テキストID'))
  @IsOptional()
  readonly textId?: string

  @IsString(ValidationUtils.requiredString('Discordチャンネル'))
  readonly discordChannelId: string

  @IsString(ValidationUtils.optionalString('キャラクターID'))
  @IsOptional()
  readonly characterId?: string

  @IsString(ValidationUtils.optionalString('ダイスロール'))
  @IsOptional()
  readonly diceRoll?: string

  @IsString(ValidationUtils.optionalString('テキスト'))
  @IsOptional()
  readonly text?: string

  @IsString(ValidationUtils.optionalString('結果'))
  @IsOptional()
  readonly result?: string

  @IsBoolean()
  @IsOptional()
  readonly isSecret?: boolean
}
