import { IsString, IsOptional, IsIn, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { ValidationUtils } from '../../../core/dto/base.dto'

/**
 * Discordスレッド作成DTO
 */
export class CreateDiscordThreadDto {
  @ApiProperty({ description: 'Discord チャンネルID', example: '123456789012345678' })
  @IsString(ValidationUtils.requiredString('チャンネルID'))
  @IsNotEmpty({ message: 'チャンネルIDは必須です' })
  readonly channelId: string

  @ApiProperty({ description: 'Discord ギルドID', example: '123456789012345678' })
  @IsString(ValidationUtils.requiredString('ギルドID'))
  @IsNotEmpty({ message: 'ギルドIDは必須です' })
  readonly guildId: string
}

/**
 * Discordキャラクター表示DTO
 */
export class DisplayCharacterOnDiscordDto {
  @ApiProperty({ description: 'Discord チャンネルID', example: '123456789012345678' })
  @IsString(ValidationUtils.requiredString('チャンネルID'))
  @IsNotEmpty({ message: 'チャンネルIDは必須です' })
  readonly channelId: string

  @ApiProperty({ description: 'Discord ギルドID', example: '123456789012345678' })
  @IsString(ValidationUtils.requiredString('ギルドID'))
  @IsNotEmpty({ message: 'ギルドIDは必須です' })
  readonly guildId: string

  @ApiProperty({
    description: '表示タイプ',
    enum: ['basic', 'enhanced', 'compact'],
    example: 'enhanced',
    required: false
  })
  @IsOptional()
  @IsIn(['basic', 'enhanced', 'compact'], {
    message: '表示タイプは basic, enhanced, compact のいずれかである必要があります'
  })
  readonly displayType?: 'basic' | 'enhanced' | 'compact'
}

/**
 * Discord操作結果DTO
 */
export class DiscordOperationResultDto {
  @ApiProperty({ description: '操作メッセージ', example: 'Discord Embed更新を要求しました' })
  readonly message: string

  @ApiProperty({ description: '操作ID（オプショナル）', required: false })
  readonly operationId?: string

  @ApiProperty({ description: '操作開始時刻', example: '2025-01-17T10:30:00.000Z' })
  readonly timestamp: string

  constructor(message: string, operationId?: string) {
    this.message = message
    this.operationId = operationId
    this.timestamp = new Date().toISOString()
  }
}
