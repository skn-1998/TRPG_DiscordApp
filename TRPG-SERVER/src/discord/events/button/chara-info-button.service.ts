import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  StringSelectMenuBuilder,
  TextChannel
} from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import {
  addCharacterInfoConfig,
  changeCharacterInfoConfig,
  eventSelectButtonType
} from '../events.list'
import { ChangeCharaInfoService } from '../select/change-chara-info.service'

@Injectable()
export class CharaInfoButtonService implements discordButtonType {
  constructor() {}
  initialSetting(config: eventSelectButtonType, buttonStyle: ButtonStyle) {
    this._buttonConfig = config
    this._buttonStyle = buttonStyle
    return this
  }
  private _buttonStyle: ButtonStyle
  private _buttonConfig: eventSelectButtonType
  get data(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(this._buttonConfig.customId)
      .setLabel(this._buttonConfig.label)
      .setStyle(ButtonStyle.Primary)
  }
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    const select = new ChangeCharaInfoService().data
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      select
    )
    await interaction.deferUpdate()
    await interaction.channel?.send({ components: [row] })
  }

  async createButton(channel: TextChannel): Promise<void> {
    const addCharacterInfoButton = new CharaInfoButtonService().initialSetting(
      addCharacterInfoConfig,
      ButtonStyle.Primary
    )
    const changeCharacterInfoButton =
      new CharaInfoButtonService().initialSetting(
        changeCharacterInfoConfig,
        ButtonStyle.Secondary
      )
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
      addCharacterInfoButton.data,
      changeCharacterInfoButton.data
    ])

    await channel.send({ components: [row] })
  }
}
