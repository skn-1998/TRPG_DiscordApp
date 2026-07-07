import { IsOptional, IsString, IsNotEmpty, IsNumber, IsBoolean, ValidateNested } from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { DiscordDto, ValidationUtils } from '../../../core/dto/base.dto'

/**
 * AttributeValue用DTO
 */
export class AttributeValueDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  index?: number

  @IsOptional()
  values?: Record<string, number> = {}

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean
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

  @IsString(ValidationUtils.optionalString('Discordスレッド'))
  @IsOptional()
  readonly discordThreadId?: string

  @IsString(ValidationUtils.requiredString('キャラクター名'))
  readonly characterName: string

  @IsString(ValidationUtils.requiredString('ゲームシステムID'))
  readonly gameSystemId: string

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  readonly status?: Record<string, AttributeValueDto>

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  readonly parameter?: Record<string, AttributeValueDto>

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  readonly skill?: Record<string, AttributeValueDto>

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  readonly item?: Record<string, AttributeValueDto>

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  readonly description?: Record<string, AttributeValueDto>
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
  @IsString(ValidationUtils.optionalString('Discordスレッド'))
  readonly discordThreadId?: string

  @IsOptional()
  @IsString(ValidationUtils.optionalString('キャラクター名'))
  readonly characterName?: string

  @IsOptional()
  @IsString(ValidationUtils.optionalString('ゲームシステムID'))
  readonly gameSystemId?: string

  @IsOptional()
  readonly status?: Record<string, AttributeValueDto>

  @IsOptional()
  readonly parameter?: Record<string, AttributeValueDto>

  @IsOptional()
  readonly skill?: Record<string, AttributeValueDto>

  @IsOptional()
  readonly item?: Record<string, AttributeValueDto>

  @IsOptional()
  readonly description?: Record<string, AttributeValueDto>
}

/**
 * キャラクターID用Param DTO
 */
export class CharacterIdParamDto {
  @IsString({ message: 'idは必須です' })
  @IsNotEmpty({ message: 'idは空にできません' })
  readonly id: string
}
