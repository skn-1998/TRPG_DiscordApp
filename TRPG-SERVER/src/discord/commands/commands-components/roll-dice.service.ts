import { Injectable } from '@nestjs/common'
import { discordCommandType } from 'src/discord/discord.type'
import { SlashCommandBuilder, CommandInteraction } from 'discord.js'
import { rollDiceConfig } from 'src/discord/commands/commands.list'
import { BaseCommandService } from '../base-command.service'
import { TypedEventService } from 'src/core/events/typed-event.service'

// featuresへ委譲
import { RollDiceOrchestrator } from 'src/discord/features/diceRoll'

@Injectable()
export class RollDiceService extends BaseCommandService implements discordCommandType {
  constructor(
    private readonly orchestrator: RollDiceOrchestrator,
    typedEventService: TypedEventService
  ) {
    super(typedEventService, RollDiceService.name)
  }
  public data = new SlashCommandBuilder()
    .setName(rollDiceConfig.name)
    .setDescription(rollDiceConfig.description)
    .addStringOption((option) => option.setName('command').setDescription('コマンドを入力 例: 1d6').setRequired(true))

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!(await this.preExecute(interaction))) return
    if (!interaction.isChatInputCommand()) return

    if (!this.validateChannel(interaction)) return

    try {
      await this.orchestrator.execute(interaction)
      await this.postExecute(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'ダイスロールコマンド実行')
    }
  }
}
