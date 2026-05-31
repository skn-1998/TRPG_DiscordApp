import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../base/interaction-handler.base'
import { DicePageFirstButtonService } from '../../../features/diceRoll/adapters/dice-page-first-button.adapter'

/**
 * ダイスページ最初へボタンハンドラー
 *
 * customId: dice-page-first または dice-first*{messageId}*{channelId}
 */
@Injectable()
export class DicePageFirstHandler extends ButtonInteractionHandler {
  constructor(private readonly dicePageFirstService: DicePageFirstButtonService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'dice-page-first'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice page first: ${interaction.customId}`)
    await this.dicePageFirstService.execute(interaction)
  }
}
