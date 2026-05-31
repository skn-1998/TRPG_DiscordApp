import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from '../base/interaction-handler.base'
import { CharacterTabButtonsService } from '../../../features/characterThread/character-tab-buttons.service'

/**
 * キャラクタータブボタンハンドラー
 *
 * customId: character-tab*{channelId}*{tabType}
 *
 * tabType: basic, status, skill, item, detail
 */
@Injectable()
export class CharacterTabHandler extends ButtonInteractionHandler {
  constructor(private readonly characterTabButtonsService: CharacterTabButtonsService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'character-tab*'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling character tab: ${interaction.customId}`)
    await this.characterTabButtonsService.execute(interaction)
  }
}
