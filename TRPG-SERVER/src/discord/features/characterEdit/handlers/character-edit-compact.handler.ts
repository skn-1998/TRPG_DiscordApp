import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { EnhancedCharacterEditService } from '../enhanced-character-edit.service'
import { CharacterCompactCustomId } from '../custom-id'

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
    return CharacterCompactCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling character compact view: ${interaction.customId}`)
    await this.characterEditService.handleCompact(interaction)
  }
}
