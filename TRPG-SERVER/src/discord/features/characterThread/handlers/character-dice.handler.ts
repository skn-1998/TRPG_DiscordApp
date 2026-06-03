import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { CharacterDiceButtonsService } from '../services/character-dice-buttons.service'

/**
 * キャラクターダイスボタンハンドラー
 *
 * customId: character-dice*{action}*{characterId}
 */
@Injectable()
export class CharacterDiceHandler extends ButtonInteractionHandler {
  constructor(private readonly characterDiceButtonsService: CharacterDiceButtonsService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'character-dice'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling character dice: ${interaction.customId}`)
    await this.characterDiceButtonsService.execute(interaction)
  }
}
