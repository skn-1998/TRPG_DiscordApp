import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { DicePageNextButtonService } from '../../adapters/dice-page-next-button.adapter'

/**
 * ダイスページ進むボタンハンドラー
 *
 * customId: dice-page-next または dice-next*{messageId}*{channelId}
 */
@Injectable()
export class DicePageNextHandler extends ButtonInteractionHandler {
  constructor(private readonly dicePageNextService: DicePageNextButtonService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'dice-page-next'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice page next: ${interaction.customId}`)
    await this.dicePageNextService.execute(interaction)
  }
}
