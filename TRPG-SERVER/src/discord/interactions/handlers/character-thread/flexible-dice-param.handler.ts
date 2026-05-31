import { Injectable } from '@nestjs/common'
import { StringSelectMenuInteraction } from 'discord.js'
import { SelectMenuInteractionHandler } from '../base/interaction-handler.base'
import { CharacterThreadSelectService } from '../../select/character-thread-select.service'

/**
 * 柔軟ダイスパラメータ選択ハンドラー
 *
 * customId: flexible-dice-param*{characterId}
 */
@Injectable()
export class FlexibleDiceParamHandler extends SelectMenuInteractionHandler {
  constructor(private readonly characterThreadSelectService: CharacterThreadSelectService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'flexible-dice-param*'
  }

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    this.logger.debug(`Handling flexible dice param: ${interaction.customId}`)
    await this.characterThreadSelectService.execute(interaction)
  }
}
