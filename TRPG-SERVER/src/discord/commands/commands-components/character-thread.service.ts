import { Injectable } from '@nestjs/common'
import {
  ActionRowBuilder,
  CacheType,
  CommandInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js'
import { discordCommandType } from 'src/discord/discord.type'
import { createCharacterThreadConfig } from '../commands.list'
import { CharacterChannelService } from 'src/discord/events/select/character-channel.service'

@Injectable()
export class CharacterThreadService implements discordCommandType {
  public data = new SlashCommandBuilder()
    .setName(createCharacterThreadConfig.name)
    .setDescription(createCharacterThreadConfig.description)
  async execute(interaction: CommandInteraction<CacheType>): Promise<void> {
    if (!interaction.isChatInputCommand()) return

    try {
      const selectChannel =
        new CharacterChannelService().getAndSetChannelOption(interaction)
      const selectChannelRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          selectChannel
        )
      interaction.reply({
        content: 'キャラクターを選択',
        components: [selectChannelRow],
        ephemeral: true
      })
    } catch (error) {
      await handleError(interaction, error)
    }
  }
}

async function handleError(
  interaction: CommandInteraction,
  error: unknown
): Promise<void> {
  if (error instanceof Error) {
    console.error('エラーが発生しました:', error.message)
    await interaction.reply('An error has occurred:  ' + error.message)
  } else {
    console.error('未知のエラーが発生しました')
  }
}
