/**
 * Thread Creation DTOs
 *
 * 必要最小限のDTOのみを定義（過度な抽象化を排除）
 */

import { IsString, IsNotEmpty } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * キャラクタースレッド作成リクエストDTO
 */
export class CreateCharacterThreadDto {
  @ApiProperty({
    description: 'キャラクターID',
    example: 'char_123456789'
  })
  @IsString()
  @IsNotEmpty()
  readonly characterId: string

  @ApiProperty({
    description: 'キャラクター名',
    example: '勇者アレックス'
  })
  @IsString()
  @IsNotEmpty()
  readonly characterName: string

  @ApiProperty({
    description: 'チャンネルID',
    example: '987654321098765432'
  })
  @IsString()
  @IsNotEmpty()
  readonly channelId: string

  @ApiProperty({
    description: 'スレッド作成者のユーザーID',
    example: '123456789012345678'
  })
  @IsString()
  @IsNotEmpty()
  readonly creatorId: string

  @ApiProperty({
    description: 'ギルドID',
    example: '111222333444555666'
  })
  @IsString()
  @IsNotEmpty()
  readonly guildId: string
}

/**
 * スレッド作成レスポンスDTO
 */
export class CreateCharacterThreadResponseDto {
  @ApiProperty({
    description: '作成されたスレッドID',
    example: 'thread_987654321'
  })
  readonly threadId: string

  @ApiProperty({
    description: 'キャラクター名',
    example: '勇者アレックス'
  })
  readonly characterName: string

  @ApiProperty({
    description: 'Discord スレッドID',
    example: '888999000111222333'
  })
  readonly discordThreadId: string

  @ApiProperty({
    description: '作成日時',
    example: '2025-01-05T12:00:00.000Z'
  })
  readonly createdAt: Date

  @ApiProperty({
    description: 'スレッドURL',
    example: 'https://discord.com/channels/111222333444555666/987654321098765432/888999000111222333'
  })
  readonly threadUrl: string

  @ApiProperty({
    description: '作成が成功したかどうか',
    example: true
  })
  readonly success: boolean

  @ApiPropertyOptional({
    description: 'エラーメッセージ（失敗時のみ）',
    example: null
  })
  readonly error?: string
}
