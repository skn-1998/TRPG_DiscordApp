import { IsOptional, IsString, IsNotEmpty, IsNumber, IsBoolean, Validate } from 'class-validator'
import { Transform } from 'class-transformer'
import { DiscordDto, ValidationUtils } from '../../../core/dto/base.dto'
import { AttributeNumberPartsConstraint, AttributeSectionConstraint } from './attribute-value.validator'

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
  @Validate(AttributeNumberPartsConstraint)
  values?: Record<string, number> = {}

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  dice?: string

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
  override readonly discordChannelId?: string

  @IsString(ValidationUtils.optionalString('Discordスレッド'))
  @IsOptional()
  readonly discordThreadId?: string

  @IsString(ValidationUtils.requiredString('キャラクター名'))
  readonly characterName: string

  @IsString(ValidationUtils.requiredString('ゲームシステムID'))
  readonly gameSystemId: string

  @IsOptional()
  @Validate(AttributeSectionConstraint)
  readonly status?: Record<string, AttributeValueDto>

  @IsOptional()
  @Validate(AttributeSectionConstraint)
  readonly parameter?: Record<string, AttributeValueDto>

  @IsOptional()
  @Validate(AttributeSectionConstraint)
  readonly skill?: Record<string, AttributeValueDto>

  @IsOptional()
  @Validate(AttributeSectionConstraint)
  readonly item?: Record<string, AttributeValueDto>

  @IsOptional()
  @Validate(AttributeSectionConstraint)
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
  @Validate(AttributeSectionConstraint)
  readonly status?: Record<string, AttributeValueDto>

  @IsOptional()
  @Validate(AttributeSectionConstraint)
  readonly parameter?: Record<string, AttributeValueDto>

  @IsOptional()
  @Validate(AttributeSectionConstraint)
  readonly skill?: Record<string, AttributeValueDto>

  @IsOptional()
  @Validate(AttributeSectionConstraint)
  readonly item?: Record<string, AttributeValueDto>

  @IsOptional()
  @Validate(AttributeSectionConstraint)
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
