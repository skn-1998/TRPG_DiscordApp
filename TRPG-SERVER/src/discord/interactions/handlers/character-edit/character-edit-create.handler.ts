import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../base/interaction-handler.base'
import { EnhancedCharacterEditService } from '../../../features/characterEdit/enhanced-character-edit.service'

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
    return /^character-create-(basic|cancel)-/
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling character create: ${interaction.customId}`)
    await this.characterEditService.handleButtonInteraction(interaction)
  }
}
