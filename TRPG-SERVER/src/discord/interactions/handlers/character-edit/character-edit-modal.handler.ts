import { Injectable } from '@nestjs/common'
import { ModalSubmitInteraction } from 'discord.js'
import { ModalInteractionHandler } from '../base/interaction-handler.base'
import { EnhancedCharacterEditService } from '../../../features/characterEdit/enhanced-character-edit.service'

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
    return /^char-edit(-modal)?-/
  }

  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    this.logger.debug(`Handling character edit modal: ${interaction.customId}`)
    await this.characterEditService.handleModalSubmitInteraction(interaction)
  }
}
