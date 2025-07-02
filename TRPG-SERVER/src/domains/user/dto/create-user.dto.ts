import { IsArray, IsDate, IsOptional, IsString } from 'class-validator'

export class CreateUserDto {
  @IsString()
  readonly discordUserId: string

  @IsString()
  readonly name: string

  @IsString()
  @IsOptional()
  readonly avatarHash?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  readonly characterIds?: string[]

  // Discord OAuth トークン関連フィールド
  @IsString()
  @IsOptional()
  readonly discordAccessToken?: string

  @IsString()
  @IsOptional()
  readonly discordRefreshToken?: string

  @IsDate()
  @IsOptional()
  readonly discordTokenExpiresAt?: Date

  @IsString()
  @IsOptional()
  readonly discordTokenScope?: string
}
