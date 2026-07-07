import { Injectable, Logger } from '@nestjs/common'
import { CommandInteraction, ChannelType } from 'discord.js'
import { isNull } from 'lodash'
import dice from 'src/domains/dice-roll/services/bcdice.util'
import { getGameSystemIdFromTopic, getParentChannelTopic } from '../utils/channel-topic.util'

@Injectable()
export class RollDiceOrchestrator {
  private readonly logger = new Logger(RollDiceOrchestrator.name)

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return

    const command = interaction.options.getString('command', true)
    if (isNull(command)) return

    const channel = interaction.channel
    if (!channel) {
      await interaction.reply('⚠️ チャンネルが取得できませんでした。')
      return
    }
    const topic = channel.type === ChannelType.GuildText ? channel.topic : getParentChannelTopic(interaction)
    const gameSystemId = getGameSystemIdFromTopic(topic)

    this.logger.debug('ダイスロールオーケストレーション', { command, gameSystemId })

    const diceResult = await dice(command, gameSystemId)
    if (isNull(diceResult)) {
      await interaction.reply('無効なコマンドです' + '\n' + command)
      return
    }
    await interaction.reply(diceResult.text)
  }
}
