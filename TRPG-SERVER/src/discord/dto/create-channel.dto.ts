import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export enum CreateChannelType {
  TEXT = 'text',
  VOICE = 'voice',
  CATEGORY = 'category',
  THREAD = 'thread'
}

export class CreateChannelDto {
  @ApiProperty({ description: 'チャンネルを作成するギルドID' })
  @IsNotEmpty({ message: 'ギルドIDは必須です' })
  @IsString({ message: 'ギルドIDは文字列で入力してください' })
  readonly guildId: string

  @ApiProperty({ description: 'チャンネル名' })
  @IsNotEmpty({ message: 'チャンネル名は必須です' })
  @IsString({ message: 'チャンネル名は文字列で入力してください' })
  readonly name: string

  @ApiProperty({
    description: 'チャンネルタイプ',
    enum: CreateChannelType,
    default: CreateChannelType.TEXT
  })
  @IsOptional()
  @IsEnum(CreateChannelType, { message: 'チャンネルタイプは有効な値で入力してください' })
  readonly type?: CreateChannelType

  @ApiProperty({ description: 'チャンネルの説明', required: false })
  @IsOptional()
  @IsString({ message: 'チャンネル説明は文字列で入力してください' })
  readonly topic?: string

  @ApiProperty({ description: '親カテゴリーID', required: false })
  @IsOptional()
  @IsString({ message: '親カテゴリーIDは文字列で入力してください' })
  readonly parentId?: string

  @ApiProperty({ description: 'チャンネルの位置', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'チャンネルの位置は数値で入力してください' })
  @Min(0, { message: 'チャンネルの位置は0以上で入力してください' })
  readonly position?: number

  @ApiProperty({ description: '年齢制限（NSFW）', required: false })
  @IsOptional()
  readonly nsfw?: boolean

  @ApiProperty({ description: '低速モード（秒）', required: false })
  @IsOptional()
  @IsNumber({}, { message: '低速モードは数値で入力してください' })
  @Min(0, { message: '低速モードは0秒以上で入力してください' })
  @Max(21600, { message: '低速モードは21600秒以下で入力してください' }) // 6時間
  readonly rateLimitPerUser?: number

  @ApiProperty({ description: 'チャンネル権限設定', required: false })
  @IsOptional()
  readonly permissions?: any[]
}
