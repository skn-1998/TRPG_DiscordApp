import { Injectable } from '@nestjs/common'
import { ButtonInteraction } from 'discord.js'
import { ButtonInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { CharacterTabButtonsService } from '../character-tab-buttons.service'
// P1-D slice2: handler pattern を feature-local 契約モジュールへ集約（pattern 完全同一）
import { CharacterTabCustomId } from '../custom-id'

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
    return CharacterTabCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Handling character tab: ${interaction.customId}`)
    await this.characterTabButtonsService.execute(interaction)
  }
}
