import { Injectable } from '@nestjs/common'
import { StringSelectMenuInteraction } from 'discord.js'
import { SelectMenuInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { CharacterThreadSelectService } from '../services/character-thread-select.service'

/**
 * キャラクタースレッド作成選択ハンドラー
 *
 * customId: character-thread-create-select
 */
@Injectable()
export class CharacterThreadCreateHandler extends SelectMenuInteractionHandler {
  constructor(private readonly characterThreadSelectService: CharacterThreadSelectService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'character-thread-create-select'
  }

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    this.logger.debug(`Handling character thread create: ${interaction.customId}`)
    await this.characterThreadSelectService.execute(interaction)
  }
}
