import { Injectable } from '@nestjs/common'
import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import {
  changeCharacterInfoConfig,
  eventButtonType,
  eventSelectButtonType,
  eventType
} from '../events.list'
import { AddCharaInfoService } from '../modal/add-chara-info.service'

@Injectable()
export class ChangeCharaInfoService implements discordSelectMenuType {
  public data = new StringSelectMenuBuilder()
    .setCustomId(changeCharacterInfoConfig.customId)
    .setPlaceholder(changeCharacterInfoConfig.placeholder)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('ステータス')
        .setValue('status'),
      new StringSelectMenuOptionBuilder()
        .setLabel('パラメータ')
        .setValue('parameter'),
      new StringSelectMenuOptionBuilder().setLabel('スキル').setValue('skill')
    )
  async execute(
    interaction: AnySelectMenuInteraction,
    characterInfoConfig: eventSelectButtonType
  ): Promise<void> {
    const modal = new AddCharaInfoService().initialSetting(
      characterInfoConfig
    ).data
    const inputCharacterInfo = new TextInputBuilder()
      .setCustomId(`${interaction.customId}-${interaction.values[0]}`)
      .setStyle(TextInputStyle.Paragraph)
      .setLabel('例のように入力')
      .setPlaceholder('HP:13\nMP:30')

    if (changeCharacterInfoConfig.customId.includes(interaction.customId)) {
      // const characterInfo = await getCharacter(interaction.channelId)
      // if(isUndefined(characterInfo)) return
      // inputCharacterInfo.setValue(convertCharacterJsonToString(characterInfo,interaction.values[0] as updatePrimary))
    }

    const firstActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputCharacterInfo)
    interaction.deleteReply()
    modal.addComponents(firstActionRow)
    await interaction.showModal(modal)
  }
}
