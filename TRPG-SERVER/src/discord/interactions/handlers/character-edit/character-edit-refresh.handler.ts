import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../base/interaction-handler.base'
import { EnhancedCharacterEditService } from '../../../features/characterEdit/enhanced-character-edit.service'

/**
 * キャラクター更新ボタンハンドラー
 *
 * customId: character-refresh-{characterId}
 */
@Injectable()
export class CharacterEditRefreshHandler extends ButtonInteractionHandler {
  constructor(private readonly characterEditService: EnhancedCharacterEditService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'character-refresh-'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling character refresh: ${interaction.customId}`)
    await this.characterEditService.handleButtonInteraction(interaction)
  }
}
