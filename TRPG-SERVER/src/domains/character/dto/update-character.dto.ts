import { PartialType } from '@nestjs/mapped-types'
import { CreateCharacterDto } from './create-character.dto'

/**
 * キャラクター更新DTO
 */
export class UpdateCharacterDto extends PartialType(CreateCharacterDto) {}

/**
 * キャラクター出力DTO（軽量データ）
 */
export class CharacterOutputDto {
  readonly characterId: string
  readonly discordUserId: string
  readonly characterName: string
  readonly gameSystemId: string
  readonly discordChannelId?: string
  readonly createdAt?: Date
  readonly updatedAt?: Date
}
