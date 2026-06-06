import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { DicePageFirstButtonService } from '../../adapters/dice-page-first-button.adapter'
import { DicePageCustomId } from '../../custom-id'

/**
 * ダイスページ最初へボタンハンドラー
 *
 * customId: dice-page-first*{messageId}*{channelId}
 */
@Injectable()
export class DicePageFirstHandler extends ButtonInteractionHandler {
  constructor(private readonly dicePageFirstService: DicePageFirstButtonService) {
    super()
  }

  getCustomIdPattern(): string {
    return DicePageCustomId.patterns.first
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling dice page first: ${interaction.customId}`)
    await this.dicePageFirstService.execute(interaction)
  }
}
