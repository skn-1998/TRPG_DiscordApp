import { Injectable } from '@nestjs/common'
import { StringSelectMenuInteraction } from 'discord.js'
import { SelectMenuInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { EnhancedCharacterEditService } from '../enhanced-character-edit.service'
import { CharacterFieldCustomId } from '../custom-id'

/**
 * キャラクターフィールド選択ハンドラー
 *
 * customId: character-field-{section}-{characterId}
 */
@Injectable()
export class CharacterEditFieldHandler extends SelectMenuInteractionHandler {
  constructor(private readonly characterEditService: EnhancedCharacterEditService) {
    super()
  }

  getCustomIdPattern(): string {
    return CharacterFieldCustomId.pattern
  }

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    this.logger.debug(`Handling character field select: ${interaction.customId}`)
    await this.characterEditService.handleSelectMenuInteraction(interaction)
  }
}
