import { Injectable } from '@nestjs/common'
import { discordCommandType } from 'src/discord/discord.type'
import {
  SlashCommandBuilder,
  CommandInteraction,
  ChannelType
} from 'discord.js'
import { isNull } from 'lodash'
import dice from 'src/discord/utils/dice'
import { loadJsonFile } from 'src/discord/utils/loadJsonFile'
import { GameSystemJSON } from './select-game-system.service'
import { rollDiceConfig } from 'src/discord/commands/commands.list'

const gameSystemList = loadJsonFile(
  'src/discord/static/gameSystemList.json'
) as GameSystemJSON[]

@Injectable()
export class RollDiceService implements discordCommandType {
  public data = new SlashCommandBuilder()
    .setName(rollDiceConfig.name)
    .setDescription(rollDiceConfig.description)
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('コマンドを入力 例: 1d6')
        .setRequired(true)
    )

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return
    const command = interaction.options.getString('command', true)
    if (isNull(command)) return
    const channel = interaction.channel
    if (isNull(channel)) return

    const topic =
      channel.type === ChannelType.GuildText
        ? channel.topic
        : getParentChannelTopic(interaction)

    const gameSystemId = getGameSystemIdFromTopic(topic)

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

export function getGameSystemIdFromTopic(
  topic: string | null | undefined
): string | undefined {
  if (!topic) return
  // チャンネルトピックの2行目にゲームシステムのIDを埋め込む実装なので、
  // 2行目からID部分を切り出している
  const id = topic.split('\n')[1]?.replace(/^ID:/, '')
  return gameSystemList.find(e => e.ID === id)?.ID
}

export function getParentChannelTopic(
  interaction: CommandInteraction
): string | null | undefined {
  if (
    interaction.channel?.type === ChannelType.PrivateThread ||
    interaction.channel?.type === ChannelType.PublicThread
  ) {
    return interaction.channel.parent?.topic
  }
}
