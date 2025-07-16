import { Injectable } from '@nestjs/common'
import { discordCommandType } from 'src/discord/discord.type'
import { SlashCommandBuilder, CommandInteraction, ChannelType } from 'discord.js'
import { isNull } from 'lodash'
import dice from 'src/discord/utils/dice'
import { loadJsonFile } from 'src/discord/utils/loadJsonFile'
import { GameSystemJSON } from './select-game-system.service'
import { rollDiceConfig } from 'src/discord/commands/commands.list'
import { BaseCommandService } from '../base-command.service'
import { TypedEventService } from 'src/shared/application/typed-event.service'

const gameSystemList = loadJsonFile('src/discord/static/gameSystemList.json') as GameSystemJSON[]

@Injectable()
export class RollDiceService extends BaseCommandService implements discordCommandType {
  constructor(typedEventService: TypedEventService) {
    super(typedEventService, RollDiceService.name)
  }
  public data = new SlashCommandBuilder()
    .setName(rollDiceConfig.name)
    .setDescription(rollDiceConfig.description)
    .addStringOption((option) => option.setName('command').setDescription('コマンドを入力 例: 1d6').setRequired(true))

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!(await this.preExecute(interaction))) return
    if (!interaction.isChatInputCommand()) return

    const command = interaction.options.getString('command', true)
    if (isNull(command)) return

    if (!this.validateChannel(interaction)) return

    const channel = interaction.channel!
    const topic = channel.type === ChannelType.GuildText ? channel.topic : getParentChannelTopic(interaction)
    const gameSystemId = getGameSystemIdFromTopic(topic)

    this.logger.debug('ダイスロールコマンド実行', { command, gameSystemId })

    try {
      const diceResult = await dice(command, gameSystemId)
      if (isNull(diceResult)) {
        await interaction.reply('無効なコマンドです' + '\n' + command)
        return
      }
      await interaction.reply(diceResult.text)

      await this.postExecute(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'ダイスロールコマンド実行')
    }
  }
}

export function getGameSystemIdFromTopic(topic: string | null | undefined): string | undefined {
  if (!topic) return
  // チャンネルトピックの2行目にゲームシステムのIDを埋め込む実装なので、
  // 2行目からID部分を切り出している
  const id = topic.split('\n')[1]?.replace(/^ID:/, '')
  return gameSystemList.find((e) => e.ID === id)?.ID
}

export function getParentChannelTopic(interaction: CommandInteraction): string | null | undefined {
  if (
    interaction.channel?.type === ChannelType.PrivateThread ||
    interaction.channel?.type === ChannelType.PublicThread
  ) {
    return interaction.channel.parent?.topic
  }
  return null
}
