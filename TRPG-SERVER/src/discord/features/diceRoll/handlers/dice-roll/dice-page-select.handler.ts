import { Injectable } from '@nestjs/common'
import { StringSelectMenuInteraction } from 'discord.js'
import { SelectMenuInteractionHandler } from '../../../../interactions/handlers/base/interaction-handler.base'
import { DicePageSelectMenuService } from '../../adapters/dice-page-select-menu.adapter'
import { DicePageCustomId } from '../../custom-id'

/**
 * ダイスページ選択メニューハンドラー
 *
 * customId: dice-page-select*{messageId}*{channelId}
 */
@Injectable()
export class DicePageSelectHandler extends SelectMenuInteractionHandler {
  constructor(private readonly dicePageSelectService: DicePageSelectMenuService) {
    super()
  }

  getCustomIdPattern(): string {
    return DicePageCustomId.patterns.select
  }

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    this.logger.debug(`Handling dice page select: ${interaction.customId}`)
    await this.dicePageSelectService.execute(interaction)
  }
}
