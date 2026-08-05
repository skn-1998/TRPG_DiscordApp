import { PartialType } from '@nestjs/mapped-types'
import { CreateUserDto } from './create-user.dto'

/**
 * ユーザー更新DTO
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}

/**
 * ユーザー出力DTO（軽量データ）
 * avatarHash は presenter が null を素通しする実態に合わせる。
 */
export class UserOutputDto {
  readonly discordUserId: string
  readonly name: string
  readonly avatarHash?: string | null
  readonly characterIds: string[]
}
