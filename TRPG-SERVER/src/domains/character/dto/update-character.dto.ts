import { PartialType } from '@nestjs/mapped-types'
import { CreateCharacterDto } from './create-character.dto'

/**
 * キャラクター更新DTO
 */
export class UpdateCharacterDto extends PartialType(CreateCharacterDto) {}
