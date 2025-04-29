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
  constructor(private readonly characterChannelService: CharacterChannelService) {}

  public data = new SlashCommandBuilder()
    .setName(createCharacterThreadConfig.name)
    .setDescription(createCharacterThreadConfig.description)

  async execute(interaction: CommandInteraction<CacheType>): Promise<void> {
    if (!interaction.isChatInputCommand()) return

    try {
      const selectChannel = this.characterChannelService.getAndSetChannelOption(interaction)
      const selectChannelRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectChannel)

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'キャラクターを選択',
          components: [selectChannelRow],
          ephemeral: true
        })
      } else {
        console.log('インタラクションは既に応答済みです')
      }
    } catch (error) {
      console.error('キャラクター選択エラー:', error)
      try {
        if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
          await interaction.reply({
            content: 'エラーが発生しました。もう一度お試しください。',
            ephemeral: true
          })
        } else if (interaction.isRepliable()) {
          await interaction.followUp({
            content: 'エラーが発生しました。もう一度お試しください。',
            ephemeral: true
          })
        }
      } catch (replyError) {
        console.error('エラー応答に失敗:', replyError)
      }
    }
  }
}
