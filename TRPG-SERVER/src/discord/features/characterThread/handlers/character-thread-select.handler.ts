import { Injectable } from '@nestjs/common'
import { StringSelectMenuInteraction } from 'discord.js'
import { SelectMenuInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { CharacterThreadSelectService } from '../services/character-thread-select.service'
// P1-D slice2: handler pattern を feature-local 契約モジュールへ集約（pattern 完全同一）
import { CharacterThreadSelectCustomId } from '../custom-id'

/**
 * キャラクタースレッド選択メニューハンドラー
 *
 * customId: character-thread-select
 *           character-thread-select-with-thread
 *           character-thread-select-current
 */
@Injectable()
export class CharacterThreadSelectHandler extends SelectMenuInteractionHandler {
  constructor(private readonly characterThreadSelectService: CharacterThreadSelectService) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return CharacterThreadSelectCustomId.pattern
  }

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    this.logger.debug(`Handling character thread select: ${interaction.customId}`)
    await this.characterThreadSelectService.execute(interaction)
  }
}
