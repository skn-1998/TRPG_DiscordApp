import { Injectable } from '@nestjs/common'
import { ModalSubmitInteraction } from 'discord.js'
import { ModalInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { EnhancedCharacterEditService } from '../enhanced-character-edit.service'
import { CharacterModalCustomId } from '../custom-id'

/**
 * キャラクター編集モーダルハンドラー
 *
 * customId: char-edit-{section}-{field}-{characterId}
 *           char-edit-modal-{characterId}
 */
@Injectable()
export class CharacterEditModalHandler extends ModalInteractionHandler {
  constructor(private readonly characterEditService: EnhancedCharacterEditService) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return CharacterModalCustomId.pattern
  }

  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    this.logger.debug(`Handling character edit modal: ${interaction.customId}`)
    await this.characterEditService.handleModalSubmitInteraction(interaction)
  }
}
