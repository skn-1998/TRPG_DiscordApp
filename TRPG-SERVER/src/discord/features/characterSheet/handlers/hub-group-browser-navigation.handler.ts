import { Injectable } from '@nestjs/common'
import { createGroupBrowser } from '@trpg/sheet-projection'
import type { ButtonInteraction } from 'discord.js'
import { CharacterService } from '../../../../domains/character/character.service'
import { ButtonInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { HubDiscordViewBuilder } from '../adapters/hub-discord-view.builder'
import { HubGroupBrowserCustomId } from '../custom-id'

@Injectable()
export class HubGroupBrowserNavigationHandler extends ButtonInteractionHandler {
  constructor(
    private readonly characterService: CharacterService,
    private readonly viewBuilder: HubDiscordViewBuilder
  ) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return HubGroupBrowserCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    const parsed = HubGroupBrowserCustomId.parse(interaction.customId)
    const character = parsed ? await this.characterService.findByChannelId(parsed.channelId) : null
    if (parsed === null || character === null) {
      await interaction.update({ content: '❌ グループ一覧を更新できません。', components: [] })
      return
    }
    const view = createGroupBrowser({
      channelId: parsed.channelId,
      palette: character.palette ?? [],
      page: parsed.page
    })
    await interaction.update(this.viewBuilder.buildGroupBrowser(view))
  }
}
