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
import { BaseCommandService } from '../base-command.service'
import { TypedEventService } from 'src/shared/application/typed-event.service'

@Injectable()
export class CharacterThreadService extends BaseCommandService implements discordCommandType {
  constructor(
    private readonly characterChannelService: CharacterChannelService,
    typedEventService: TypedEventService
  ) {
    super(typedEventService, CharacterThreadService.name)
  }

  public data = new SlashCommandBuilder()
    .setName(createCharacterThreadConfig.name)
    .setDescription(createCharacterThreadConfig.description)

  async execute(interaction: CommandInteraction<CacheType>): Promise<void> {
    if (!(await this.preExecute(interaction))) return

    this.logger.debug('キャラクター選択コマンド実行開始')

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
        this.logger.warn('インタラクションは既に応答済みです')
      }

      await this.postExecute(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'キャラクター選択コマンド実行')
    }
  }
}
