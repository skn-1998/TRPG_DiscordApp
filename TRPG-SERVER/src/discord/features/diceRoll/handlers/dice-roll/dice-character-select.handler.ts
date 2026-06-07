import { Injectable } from '@nestjs/common'
import { StringSelectMenuInteraction } from 'discord.js'
import { SelectMenuInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { DiceCharacterSelectService } from '../../adapters/dice-character-select.adapter'
import { DiceCharacterSelectCustomId } from '../../custom-id'

/**
 * ダイスキャラクター選択メニューハンドラー
 *
 * customId: dice-char-select*{messageId}*{channelId}
 */
@Injectable()
export class DiceCharacterSelectHandler extends SelectMenuInteractionHandler {
  constructor(private readonly diceCharacterSelectService: DiceCharacterSelectService) {
    super()
  }

  getCustomIdPattern(): string {
    return DiceCharacterSelectCustomId.pattern
  }

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    this.logger.debug(`Handling dice character select: ${interaction.customId}`)
    await this.diceCharacterSelectService.execute(interaction)
  }
}
