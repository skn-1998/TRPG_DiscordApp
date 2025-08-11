import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChannelType } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { isNull } from 'lodash'
import dice from 'src/discord/utils/dice'

@Injectable()
export class DiceButtonService implements discordButtonType {
  public data = new ButtonBuilder().setCustomId('dice_button').setLabel('1d100').setStyle(ButtonStyle.Primary)

  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    const diceRoll = await dice('1d100')
    if (isNull(diceRoll)) return
    if (interaction.channel?.type != ChannelType.PublicThread) return
    if (isNull(interaction.channel.parentId)) return
    await interaction.deferUpdate()
    const channel = await interaction.client.channels.cache.get(interaction.channel.parentId)
    if (channel && channel.type == ChannelType.GuildText) {
      channel.send(diceRoll.text)
    }
  }
}
