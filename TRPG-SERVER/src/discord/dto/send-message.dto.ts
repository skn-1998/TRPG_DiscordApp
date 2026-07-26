import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  IsISO8601,
  IsUrl,
  Min,
  Max
} from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

// ネスト DTO 群: whitelist: true の ValidationPipe 下では、クラス宣言されたプロパティだけが
// 通過・保持される。Discord Embed の各パーツを HTTP 境界で明示契約にするための宣言。

export class EmbedFooterDto {
  @ApiProperty({ description: 'フッターのテキスト' })
  @IsNotEmpty()
  @IsString()
  readonly text: string

  @ApiProperty({ description: 'フッターのアイコンURL', required: false })
  @IsOptional()
  @IsUrl()
  readonly iconUrl?: string
}

export class EmbedImageDto {
  @ApiProperty({ description: '画像URL' })
  @IsUrl()
  readonly url: string
}

export class EmbedThumbnailDto {
  @ApiProperty({ description: 'サムネイルURL' })
  @IsUrl()
  readonly url: string
}

export class EmbedAuthorDto {
  @ApiProperty({ description: '著者名' })
  @IsNotEmpty()
  @IsString()
  readonly name: string

  @ApiProperty({ description: '著者リンクURL', required: false })
  @IsOptional()
  @IsUrl()
  readonly url?: string

  @ApiProperty({ description: '著者アイコンURL', required: false })
  @IsOptional()
  @IsUrl()
  readonly iconUrl?: string
}

export class EmbedDto {
  @ApiProperty({ description: 'EmbedタイトルのリンクURL', required: false })
  @IsOptional()
  @IsUrl()
  readonly url?: string

  @ApiProperty({ description: 'Embedのタイムスタンプ（ISO 8601）', required: false })
  @IsOptional()
  @IsISO8601()
  readonly timestamp?: string

  @ApiProperty({ description: 'Embedのフッター', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedFooterDto)
  readonly footer?: EmbedFooterDto

  @ApiProperty({ description: 'Embedの画像', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedImageDto)
  readonly image?: EmbedImageDto

  @ApiProperty({ description: 'Embedのサムネイル', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedThumbnailDto)
  readonly thumbnail?: EmbedThumbnailDto

  @ApiProperty({ description: 'Embedの著者', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbedAuthorDto)
  readonly author?: EmbedAuthorDto

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
