import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../base/interaction-handler.base'
import { EnhancedCharacterEditService } from '../../../features/characterEdit/enhanced-character-edit.service'

/**
 * キャラクター簡易表示ボタンハンドラー
 *
 * customId: character-compact-view-{characterId}
 */
@Injectable()
export class CharacterEditCompactHandler extends ButtonInteractionHandler {
  constructor(private readonly characterEditService: EnhancedCharacterEditService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'character-compact-view-'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling character compact view: ${interaction.customId}`)
    await this.characterEditService.handleButtonInteraction(interaction)
  }
}
