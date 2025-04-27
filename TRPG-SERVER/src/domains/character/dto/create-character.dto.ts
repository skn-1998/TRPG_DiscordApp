import { IsOptional, IsString } from 'class-validator'

/**
 * キャラクター属性の型定義
 */
export type CharacterAttribute = {
  [key: string]: string | number | boolean | null | undefined;
};

/**
 * キャラクター作成DTO
 */
export class CreateCharacterDto {
  @IsString()
  readonly characterId: string

  @IsString()
  readonly discordUserId: string

  @IsString()
  readonly discordChannelId: string

  @IsString()
  readonly characterName: string

  @IsString()
  readonly TRPGName: string

  @IsOptional()
  readonly status: CharacterAttribute = {}

  @IsOptional()
  readonly parameter: CharacterAttribute = {}

  @IsOptional()
  readonly skill: CharacterAttribute = {}
}

/**
 * キャラクター作成入力DTO（部分的に入力可能）
 */
export class PartialInputCharacterDto {
  @IsOptional()
  @IsString()
  readonly characterId?: string

  @IsOptional()
  @IsString()
  readonly discordUserId?: string

  @IsOptional()
  @IsString()
  readonly discordChannelId?: string

  @IsOptional()
  @IsString()
  readonly characterName?: string

  @IsOptional()
  @IsString()
  readonly TRPGName?: string

  @IsOptional()
  readonly status?: CharacterAttribute

  @IsOptional()
  readonly parameter?: CharacterAttribute

  @IsOptional()
  readonly skill?: CharacterAttribute

  @IsOptional()
  readonly item?: CharacterAttribute

  @IsOptional()
  readonly description?: CharacterAttribute
} 