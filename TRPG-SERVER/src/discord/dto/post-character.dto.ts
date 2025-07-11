import { IsString, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class PostCharacterDto {
  @ApiProperty({ description: 'キャラクターID' })
  @IsNotEmpty({ message: 'キャラクターIDは必須です' })
  @IsString({ message: 'キャラクターIDは文字列で入力してください' })
  readonly characterId: string

  @ApiProperty({ description: 'DiscordサーバーID（ギルドID）' })
  @IsNotEmpty({ message: 'サーバーIDは必須です' })
  @IsString({ message: 'サーバーIDは文字列で入力してください' })
  readonly guildId: string
}
