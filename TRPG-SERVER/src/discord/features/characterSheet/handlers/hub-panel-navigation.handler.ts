import { Injectable } from '@nestjs/common'
import { createEphemeralPanel } from '@trpg/sheet-projection'
import type { ButtonInteraction } from 'discord.js'
import { CharacterService } from '../../../../domains/character/character.service'
import { ButtonInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { HubDiscordViewBuilder } from '../adapters/hub-discord-view.builder'
import { HubPanelCustomId } from '../custom-id'

@Injectable()
export class HubPanelNavigationHandler extends ButtonInteractionHandler {
  constructor(
    private readonly characterService: CharacterService,
    private readonly viewBuilder: HubDiscordViewBuilder
  ) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return HubPanelCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    const parsed = HubPanelCustomId.parse(interaction.customId)
    const character = parsed ? await this.characterService.findByChannelId(parsed.channelId) : null
    if (parsed === null || character === null) {
      await interaction.update({ content: '❌ パネルを更新できません。', components: [] })
      return
    }
    const view = createEphemeralPanel({
      channelId: parsed.channelId,
      palette: character.palette ?? [],
      groupId: parsed.groupId,
      page: parsed.page
    })
    await interaction.update(this.viewBuilder.buildPanel(view))
  }
}
