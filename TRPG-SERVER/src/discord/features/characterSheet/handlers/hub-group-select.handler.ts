import { Injectable } from '@nestjs/common'
import { createEphemeralPanel, createGroupBrowser, GROUP_SELECT_MORE_VALUE } from '@trpg/sheet-projection'
import { MessageFlags, type AnySelectMenuInteraction } from 'discord.js'
import { CharacterService } from '../../../../domains/character/character.service'
import { SelectMenuInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { HubDiscordViewBuilder } from '../adapters/hub-discord-view.builder'
import { HUB_GROUP_MENU_CUSTOM_ID_PATTERN, HubGroupBrowserCustomId, HubGroupSelectCustomId } from '../custom-id'

@Injectable()
export class HubGroupSelectHandler extends SelectMenuInteractionHandler {
  constructor(
    private readonly characterService: CharacterService,
    private readonly viewBuilder: HubDiscordViewBuilder
  ) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return HUB_GROUP_MENU_CUSTOM_ID_PATTERN
  }

  async execute(interaction: AnySelectMenuInteraction): Promise<void> {
    const direct = HubGroupSelectCustomId.parse(interaction.customId)
    const browser = HubGroupBrowserCustomId.parse(interaction.customId)
    const channelId = direct?.channelId ?? browser?.channelId
    const selected = interaction.values[0]
    if (channelId === undefined || selected === undefined) {
      await interaction.reply({ content: '❌ 選択内容が不正です。', flags: MessageFlags.Ephemeral })
      return
    }

    const character = await this.characterService.findByChannelId(channelId)
    if (character === null) {
      await interaction.reply({ content: '❌ キャラクターが見つかりません。', flags: MessageFlags.Ephemeral })
      return
    }

    if (selected === GROUP_SELECT_MORE_VALUE) {
      const view = createGroupBrowser({ channelId, palette: character.palette ?? [], page: 1 })
      await interaction.reply({ ...this.viewBuilder.buildGroupBrowser(view), flags: MessageFlags.Ephemeral })
      return
    }

    const view = createEphemeralPanel({
      channelId,
      palette: character.palette ?? [],
      groupId: selected,
      page: 1
    })
    await interaction.reply({ ...this.viewBuilder.buildPanel(view), flags: MessageFlags.Ephemeral })
  }
}
