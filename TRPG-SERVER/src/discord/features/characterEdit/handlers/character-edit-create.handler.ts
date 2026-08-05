import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { EnhancedCharacterEditService } from '../enhanced-character-edit.service'
import { CharacterCreateCustomId } from '../custom-id'

/**
 * キャラクター作成ボタンハンドラー
 *
 * customId: character-create-basic-{channelId} または character-create-cancel-{channelId}
 */
@Injectable()
export class CharacterEditCreateHandler extends ButtonInteractionHandler {
  constructor(private readonly characterEditService: EnhancedCharacterEditService) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return CharacterCreateCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling character create: ${interaction.customId}`)
    await this.characterEditService.handleCreate(interaction)
  }
}
