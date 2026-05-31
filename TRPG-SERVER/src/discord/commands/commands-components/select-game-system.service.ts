import { Injectable } from '@nestjs/common'
import { discordCommandType } from 'src/discord/discord.type'
import { CommandInteraction, SlashCommandBuilder, AutocompleteInteraction } from 'discord.js'
import { SelectGameSystemOrchestrator } from 'src/discord/features/gameSystem'
import { selectGameSystemConfig } from 'src/discord/commands/commands.list'
import { BaseCommandService } from '../base-command.service'
import { TypedEventService } from 'src/core/events/typed-event.service'

export type GameSystemJSON = { ID: string; NAME: string; SORT_KEY: string; HELP_MESSAGE: string }

@Injectable()
export class SelectGameSystemService extends BaseCommandService implements discordCommandType {
  constructor(
    private readonly orchestrator: SelectGameSystemOrchestrator,
    typedEventService: TypedEventService
  ) {
    super(typedEventService, SelectGameSystemService.name)
  }
  public data = new SlashCommandBuilder()
    .setName(selectGameSystemConfig.name)
    .setDescription(selectGameSystemConfig.description)
    .addStringOption((option) =>
      option
        .setName('gamesystem')
        .setDescription('キーワードを入力してゲームシステムを検索')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('channel-name').setDescription('作成するチャンネルの名前 ※デフォルトはゲームシステム名')
    )

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    this.logger.debug('ゲームシステム選択オートコンプリート実行', { userId: interaction.user.id })
    try {
      await this.orchestrator.autocomplete(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'ゲームシステム選択オートコンプリート実行')
    }
  }

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!(await this.preExecute(interaction))) return
    if (!interaction.isChatInputCommand()) return

    if (!this.validateGuild(interaction)) return

    this.logger.debug('ゲームシステム選択実行', { userId: interaction.user.id })

    try {
      await this.orchestrator.execute(interaction)
      await this.postExecute(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'ゲームシステム選択実行')
    }
  }
}
