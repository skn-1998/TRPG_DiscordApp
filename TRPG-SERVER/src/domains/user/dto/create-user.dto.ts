import { IsArray, IsDate, IsOptional, IsString, IsNotEmpty } from 'class-validator'
import { Type } from 'class-transformer'
import { DiscordDto, ValidationUtils } from '../../../core/dto/base.dto'

/**
 * ユーザー作成DTO
 */
export class CreateUserDto extends DiscordDto {
  @IsString(ValidationUtils.requiredString('ユーザー名'))
  readonly name: string

  @IsString(ValidationUtils.optionalString('アバターハッシュ'))
  @IsOptional()
  readonly avatarHash?: string

  @IsArray(ValidationUtils.array('キャラクターID'))
  @IsString({ each: true })
  @IsOptional()
  readonly characterIds?: string[]

  // Discord OAuth トークン関連フィールド
  @IsString(ValidationUtils.optionalString('Discordアクセストークン'))
  @IsOptional()
  readonly discordAccessToken?: string

  @IsString(ValidationUtils.optionalString('Discordリフレッシュトークン'))
  @IsOptional()
  readonly discordRefreshToken?: string

  @IsDate(ValidationUtils.date('Discordトークン有効期限'))
  @IsOptional()
  @Type(() => Date)
  readonly discordTokenExpiresAt?: Date

  @IsString(ValidationUtils.optionalString('Discordトークンスコープ'))
  @IsOptional()
  readonly discordTokenScope?: string
}

/**
 * ユーザー入力DTO（部分入力可能）
 */
export class UserInputDto {
  @IsString(ValidationUtils.requiredString('DiscordユーザーID'))
  readonly discordUserId: string

  @IsString(ValidationUtils.requiredString('ユーザー名'))
  readonly name: string

  @IsString(ValidationUtils.optionalString('アバターハッシュ'))
  @IsOptional()
  readonly avatarHash?: string

  @IsArray(ValidationUtils.array('キャラクターID'))
  @IsString({ each: true })
  @IsOptional()
  readonly characterIds?: string[]
}

/**
 * ユーザーID用Param DTO
 */
export class DiscordUserIdParamDto {
  @IsString({ message: 'discordUserIdは必須です' })
  @IsNotEmpty({ message: 'discordUserIdは空にできません' })
  readonly discordUserId: string
}

/**
 * キャラクターID用Param DTO
 */
export class CharacterIdParamDto {
  @IsString({ message: 'characterIdは必須です' })
  @IsNotEmpty({ message: 'characterIdは空にできません' })
  readonly characterId: string
}
