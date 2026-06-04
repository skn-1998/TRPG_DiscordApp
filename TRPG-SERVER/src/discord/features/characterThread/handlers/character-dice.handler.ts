import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { CharacterDiceButtonsService } from '../services/character-dice-buttons.service'
// P1-D slice2: handler pattern を feature-local 契約モジュールへ集約（pattern 完全同一）
import { CharacterDiceCustomId } from '../custom-id'

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
    return CharacterDiceCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling character dice: ${interaction.customId}`)
    await this.characterDiceButtonsService.execute(interaction)
  }
}
