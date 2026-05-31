import { Injectable } from '@nestjs/common'
import { StringSelectMenuInteraction } from 'discord.js'
import { SelectMenuInteractionHandler } from '../base/interaction-handler.base'
import { DicePageSelectMenuService } from '../../../features/diceRoll/adapters/dice-page-select-menu.adapter'

/**
 * ダイスページ選択メニューハンドラー
 *
 * customId: dice-page-select
 */
@Injectable()
export class DicePageSelectHandler extends SelectMenuInteractionHandler {
  constructor(private readonly dicePageSelectService: DicePageSelectMenuService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'dice-page-select'
  }

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    this.logger.debug(`Handling dice page select: ${interaction.customId}`)
    await this.dicePageSelectService.execute(interaction)
  }
}
