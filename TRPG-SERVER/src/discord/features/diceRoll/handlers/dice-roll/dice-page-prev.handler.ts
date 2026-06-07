import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { DicePagePrevButtonService } from '../../adapters/dice-page-prev-button.adapter'
import { DicePageCustomId } from '../../custom-id'

/**
 * ダイスページ戻るボタンハンドラー
 *
 * customId: dice-page-prev*{messageId}*{channelId}
 */
@Injectable()
export class DicePagePrevHandler extends ButtonInteractionHandler {
  constructor(private readonly dicePagePrevService: DicePagePrevButtonService) {
    super()
  }

  getCustomIdPattern(): string {
    return DicePageCustomId.patterns.prev
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice page prev: ${interaction.customId}`)
    await this.dicePagePrevService.execute(interaction)
  }
}
