import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../base/interaction-handler.base'
import { DicePageCancelButtonService } from '../../../features/diceRoll/adapters/dice-page-cancel-button.adapter'

/**
 * ダイスページキャンセルボタンハンドラー
 *
 * customId: dice-page-cancel または dice-cancel*{messageId}*{channelId}
 */
@Injectable()
export class DicePageCancelHandler extends ButtonInteractionHandler {
  constructor(private readonly dicePageCancelService: DicePageCancelButtonService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'dice-page-cancel'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice page cancel: ${interaction.customId}`)
    await this.dicePageCancelService.execute(interaction)
  }
}
