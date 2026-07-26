import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class EmbedDto {
  @ApiProperty({ description: 'Embedのタイトル', required: false })
  @IsOptional()
  @IsString()
  readonly title?: string

  @ApiProperty({ description: 'Embedの説明', required: false })
  @IsOptional()
  @IsString()
  readonly description?: string

  @ApiProperty({ description: 'Embedの色（16進数）', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
      return Number.parseInt(value.slice(1), 16)
    }
    return value
  })
  @IsInt()
  @Min(0)
  @Max(0xffffff)
  readonly color?: number

  @ApiProperty({ description: 'Embedのフィールド', required: false })
  @IsOptional()
  @IsArray()
  readonly fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
}

export class SendMessageDto {
  @ApiProperty({ description: '送信先チャンネルID' })
  @IsNotEmpty({ message: 'チャンネルIDは必須です' })
  @IsString({ message: 'チャンネルIDは文字列で入力してください' })
  readonly channelId: string

  @ApiProperty({ description: '送信メッセージ内容', required: false })
  @IsOptional()
  @IsString({ message: 'メッセージは文字列で入力してください' })
  readonly content?: string

  @ApiProperty({ description: 'Embed情報', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedDto)
  readonly embed?: EmbedDto

  @ApiProperty({ description: 'Embed情報配列', required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmbedDto)
  readonly embeds?: EmbedDto[]

  @ApiProperty({ description: 'メッセージコンポーネント', required: false })
  @IsOptional()
  readonly components?: any[]

  @ApiProperty({ description: '一時的なメッセージかどうか', required: false })
  @IsOptional()
  readonly ephemeral?: boolean
}
