import { IsArray, IsOptional, IsString } from 'class-validator'

/**
 * ダイスロールチャンネル更新DTO
 */
export class UpdateDiceRollChannelDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  characterIds?: string[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  textIds?: string[]
}
