import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { DicePageLastButtonService } from '../../adapters/dice-page-last-button.adapter'

/**
 * ダイスページ最後へボタンハンドラー
 *
 * customId: dice-page-last または dice-last*{messageId}*{channelId}
 */
@Injectable()
export class DicePageLastHandler extends ButtonInteractionHandler {
  constructor(private readonly dicePageLastService: DicePageLastButtonService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'dice-page-last'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice page last: ${interaction.customId}`)
    await this.dicePageLastService.execute(interaction)
  }
}
