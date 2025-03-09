import { Injectable } from '@nestjs/common'
import { discordContextMenuType } from 'src/discord/discord.type'
import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  CommandInteraction,
  ChannelType
} from 'discord.js'
import { isNull } from 'lodash'
import dice from 'src/discord/utils/dice'
import {
  getGameSystemIdFromTopic,
  getParentChannelTopic
} from './roll-dice.service'
import { diceFromContextMenuConfig } from 'src/discord/commands/commands.list'

@Injectable()
export class DiceFromContextMenuService implements discordContextMenuType {
  public data = new ContextMenuCommandBuilder()
    .setName(diceFromContextMenuConfig.name)
    .setType(ApplicationCommandType.Message)

  async execute(interaction: CommandInteraction) {
    if (!interaction.isMessageContextMenuCommand()) return
    if (isNull(interaction.channel)) return

    const channel = interaction.channel
    const topic =
      channel.type === ChannelType.GuildText
        ? channel.topic
        : getParentChannelTopic(interaction)
    const gameSystemId = getGameSystemIdFromTopic(topic)

    const message = interaction.targetMessage
    const command = message.content

    try {
      const diceResult = await dice(command, gameSystemId)
      if (isNull(diceResult)) {
        await interaction.reply('無効なコマンドです' + '\n' + command)
        return
      }
      await interaction.reply(diceResult.text)
    } catch (e) {
      await interaction.reply(
        'エラーが発生しました。ログを確認してください' + '\n' + command
      )
      console.log(e)
    }
  }
}
