import { Injectable } from '@nestjs/common'
import { discordContextMenuType } from 'src/discord/discord.type'
import { ContextMenuCommandBuilder, ApplicationCommandType, CommandInteraction, ChannelType } from 'discord.js'
import { isNull } from 'lodash'
import dice from 'src/domains/dice-roll/services/bcdice.util'
import { getGameSystemIdFromTopic, getParentChannelTopic } from 'src/discord/features/diceRoll'
import { diceFromContextMenuConfig } from 'src/discord/commands/commands.list'
import { BaseCommandService } from '../base-command.service'
import { TypedEventService } from 'src/core/events/typed-event.service'

@Injectable()
export class DiceFromContextMenuService extends BaseCommandService implements discordContextMenuType {
  constructor(typedEventService: TypedEventService) {
    super(typedEventService, DiceFromContextMenuService.name)
  }
  public data = new ContextMenuCommandBuilder()
    .setName(diceFromContextMenuConfig.name)
    .setType(ApplicationCommandType.Message)

  async execute(interaction: CommandInteraction) {
    if (!interaction.isMessageContextMenuCommand()) return
    if (isNull(interaction.channel)) return

    this.logger.debug('コンテキストメニューダイス実行開始')

    const channel = interaction.channel
    const topic = channel.type === ChannelType.GuildText ? channel.topic : getParentChannelTopic(interaction)
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
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'コンテキストメニューダイス実行')
    }
  }
}
