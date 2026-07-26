import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import {
  ALLOWED_CHANNEL_PERMISSION_ALLOW_KEYS,
  ALLOWED_CHANNEL_PERMISSION_DENY_KEYS,
  CHANNEL_PERMISSION_OVERWRITE_TYPES,
  IsDiscordSnowflake,
  IsValidChannelPermissionOverwrites
} from './channel-permission-overwrite.validator'
import type { CreateChannelPermissionOverwrite } from './channel-permission-overwrite.validator'

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
  @IsDiscordSnowflake({ message: '親カテゴリーIDは17〜19桁のDiscord Snowflake文字列で指定してください' })
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

  @ApiProperty({
    description: 'チャンネル権限設定',
    required: false,
    type: 'array',
    items: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: '対象ユーザーまたはロールのDiscord Snowflake' },
        // enum は validator の許可キー定数から生成する（単一ソース）。allow と deny は非対称。
        allow: { type: 'array', items: { type: 'string', enum: [...ALLOWED_CHANNEL_PERMISSION_ALLOW_KEYS] } },
        deny: { type: 'array', items: { type: 'string', enum: [...ALLOWED_CHANNEL_PERMISSION_DENY_KEYS] } },
        type: { type: 'string', enum: [...CHANNEL_PERMISSION_OVERWRITE_TYPES] }
      }
    }
  })
  @IsValidChannelPermissionOverwrites()
  readonly permissions?: CreateChannelPermissionOverwrite[]
}
