import { Injectable } from '@nestjs/common'
import { discordCommandType } from 'src/discord/discord.type'
import { SlashCommandBuilder, CommandInteraction, AutocompleteInteraction } from 'discord.js'
import { UserDefinedDiceOrchestrator } from 'src/discord/features/userDefinedDice'
import { userDefinedDiceConfig } from 'src/discord/commands/commands.list'
import { BaseCommandService } from '../base-command.service'
import { TypedEventService } from 'src/core/events/typed-event.service'

@Injectable()
export class UserDefinedDiceService extends BaseCommandService implements discordCommandType {
  constructor(
    private readonly orchestrator: UserDefinedDiceOrchestrator,
    typedEventService: TypedEventService
  ) {
    super(typedEventService, UserDefinedDiceService.name)
  }
  public data = new SlashCommandBuilder()
    .setName(userDefinedDiceConfig.name)
    .setDescription(userDefinedDiceConfig.description)
    .addStringOption((option) =>
      option
        .setName('channel')
        .setDescription('キーワードを入力してチャンネルを検索')
        .setAutocomplete(true)
        .setRequired(true)
    )

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guild) return
    this.logger.debug('オートコンプリート実行', { userId: interaction.user.id })
    try {
      await this.orchestrator.autocomplete(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'オートコンプリート実行')
    }
  }

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!(await this.preExecute(interaction))) return
    if (!interaction.isChatInputCommand()) return

    if (!this.validateGuild(interaction)) return
    this.logger.debug('ユーザー定義ダイステーブル実行', { userId: interaction.user.id })
    try {
      await this.orchestrator.execute(interaction)
      await this.postExecute(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'ユーザー定義ダイステーブル実行')
    }
  }
}
