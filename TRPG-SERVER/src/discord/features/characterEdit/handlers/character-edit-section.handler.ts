import { Injectable } from '@nestjs/common'
import { StringSelectMenuInteraction } from 'discord.js'
import { SelectMenuInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { EnhancedCharacterEditService } from '../enhanced-character-edit.service'

/**
 * キャラクターセクション選択ハンドラー
 *
 * customId: character-edit-section-{characterId}
 *           character-section-select-{characterId}
 */
@Injectable()
export class CharacterEditSectionHandler extends SelectMenuInteractionHandler {
  constructor(private readonly characterEditService: EnhancedCharacterEditService) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return /^character-(edit-section|section-select)-/
  }

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    this.logger.debug(`Handling character section select: ${interaction.customId}`)
    await this.characterEditService.handleSelectMenuInteraction(interaction)
  }
}
