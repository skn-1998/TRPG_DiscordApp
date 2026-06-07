import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { DicePageCancelButtonService } from '../../adapters/dice-page-cancel-button.adapter'
import { DicePageCustomId } from '../../custom-id'

/**
 * ダイスページキャンセルボタンハンドラー
 *
 * customId: dice-page-cancel*{messageId}*{channelId}
 */
@Injectable()
export class DicePageCancelHandler extends ButtonInteractionHandler {
  constructor(private readonly dicePageCancelService: DicePageCancelButtonService) {
    super()
  }

  getCustomIdPattern(): string {
    return DicePageCustomId.patterns.cancel
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice page cancel: ${interaction.customId}`)
    await this.dicePageCancelService.execute(interaction)
  }
}
