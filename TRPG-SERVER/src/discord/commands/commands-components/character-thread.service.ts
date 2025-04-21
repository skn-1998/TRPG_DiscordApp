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
import { handleError } from 'src/discord/utils/discord.utils'

@Injectable()
export class CharacterThreadService implements discordCommandType {
  constructor(private readonly characterChannelService: CharacterChannelService) {}
  
  public data = new SlashCommandBuilder()
    .setName(createCharacterThreadConfig.name)
    .setDescription(createCharacterThreadConfig.description)
  
  async execute(interaction: CommandInteraction<CacheType>): Promise<void> {
    if (!interaction.isChatInputCommand()) return

    try {
      const selectChannel = this.characterChannelService.getAndSetChannelOption(interaction)
      const selectChannelRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectChannel)
      
      await interaction.reply({
        content: 'キャラクターを選択',
        components: [selectChannelRow],
        ephemeral: true
      })
    } catch (error) {
      await handleError(interaction, error)
    }
  }
}
