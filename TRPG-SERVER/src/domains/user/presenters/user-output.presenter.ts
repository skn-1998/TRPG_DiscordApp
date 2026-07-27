import type { UserProfileWire } from '@trpg/api-contract'
import { UserOutputDto } from '../dto/update-user.dto'
import { User } from '../models/user.model'

export function toUserOutput(user: User): UserProfileWire {
  const output: UserOutputDto = {
    discordUserId: user.discordUserId,
    name: user.name,
    ...(user.avatarHash !== undefined ? { avatarHash: user.avatarHash } : {}),
    characterIds: [...(user.characterIds ?? [])]
  }

  return output
}
