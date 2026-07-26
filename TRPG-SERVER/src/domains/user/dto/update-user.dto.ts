import { PartialType } from '@nestjs/mapped-types'
import { CreateUserDto } from './create-user.dto'

/**
 * ユーザー更新DTO
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}

/**
 * ユーザー出力DTO（軽量データ）
 */
export class UserOutputDto {
  readonly discordUserId: string
  readonly name: string
  readonly avatarHash?: string
  readonly characterIds: string[]
}

/**
 * ユーザー要約DTO
 */
export class UserSummaryDto {
  readonly discordUserId: string
  readonly name: string
  readonly avatarHash?: string
  readonly characterCount?: number
}
