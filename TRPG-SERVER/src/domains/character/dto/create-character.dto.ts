import { IsOptional, IsString, IsNotEmpty } from 'class-validator'
import { DiscordDto, ValidationUtils } from '../../../core/dto/base.dto'
import { AttributeObject } from '../../../core/dto/domain.dto'

/**
 * キャラクター属性の型定義
 */
export type CharacterAttribute = {
  [key: string]: string | number | boolean | null | undefined
}

/**
 * キャラクター作成DTO
 */
export class CreateCharacterDto extends DiscordDto {
  @IsString(ValidationUtils.requiredString('キャラクターID'))
  readonly characterId: string

  @IsString(ValidationUtils.optionalString('Discordチャンネル'))
  @IsOptional()
  readonly discordChannelId?: string

  @IsString(ValidationUtils.requiredString('キャラクター名'))
  readonly characterName: string

  @IsString(ValidationUtils.requiredString('ゲームシステムID'))
  readonly gameSystemId: string

  @IsOptional()
  readonly status?: AttributeObject

  @IsOptional()
  readonly parameter?: AttributeObject

  @IsOptional()
  readonly skill?: AttributeObject

  @IsOptional()
  readonly item?: AttributeObject

  @IsOptional()
  readonly description?: AttributeObject
}

/**
 * キャラクター入力DTO（部分入力可能）
 */
export class CharacterInputDto {
  @IsOptional()
  @IsString(ValidationUtils.optionalString('キャラクターID'))
  readonly characterId?: string

  @IsOptional()
  @IsString(ValidationUtils.optionalString('DiscordユーザーID'))
  readonly discordUserId?: string

  @IsOptional()
  @IsString(ValidationUtils.optionalString('Discordチャンネル'))
  readonly discordChannelId?: string

  @IsOptional()
  @IsString(ValidationUtils.optionalString('キャラクター名'))
  readonly characterName?: string

  @IsOptional()
  @IsString(ValidationUtils.optionalString('ゲームシステムID'))
  readonly gameSystemId?: string

  @IsOptional()
  readonly status?: AttributeObject

  @IsOptional()
  readonly parameter?: AttributeObject

  @IsOptional()
  readonly skill?: AttributeObject

  @IsOptional()
  readonly item?: AttributeObject

  @IsOptional()
  readonly description?: AttributeObject
}

/**
 * キャラクターID用Param DTO
 */
export class CharacterIdParamDto {
  @IsString({ message: 'idは必須です' })
  @IsNotEmpty({ message: 'idは空にできません' })
  readonly id: string
}
