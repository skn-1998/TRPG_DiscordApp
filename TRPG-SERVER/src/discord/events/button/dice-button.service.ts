import { Injectable } from '@nestjs/common'
import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChannelType
} from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { diceButtonConfig } from '../events.list'
import { isNull } from 'lodash'
import dice from 'src/discord/utils/dice'

@Injectable()
export class DiceButtonService implements discordButtonType {
  public data = new ButtonBuilder()
    .setCustomId(diceButtonConfig.customId)
    .setLabel(diceButtonConfig.label)
    .setStyle(ButtonStyle.Primary)
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    const diceRoll = await dice('1d100')
    if (isNull(diceRoll)) return
    if (interaction.channel?.type != ChannelType.PublicThread) return
    if (isNull(interaction.channel.parentId)) return
    // console.log(interaction)
    const channel = await interaction.client.channels.cache.get(
      interaction.channel.parentId
    )
    interaction.deferUpdate()
    if (channel && channel.type == ChannelType.GuildText) {
      channel.send(diceRoll.text)
      // console.log(channel)
    }
  }
}
