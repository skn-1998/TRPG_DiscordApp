import { Injectable } from '@nestjs/common'
import { discordCommandType } from 'src/discord/discord.type'
import { SlashCommandBuilder, CommandInteraction } from 'discord.js'
import { diceResultConfig } from 'src/discord/commands/commands.list'
import { DiceResultOrchestrator } from 'src/discord/features/diceRoll'
import { BaseCommandService } from '../base-command.service'
import { TypedEventService } from 'src/core/events/typed-event.service'

@Injectable()
export class DiceResultService extends BaseCommandService implements discordCommandType {
  constructor(
    private readonly orchestrator: DiceResultOrchestrator,
    typedEventService: TypedEventService
  ) {
    super(typedEventService, DiceResultService.name)
  }
  public data = new SlashCommandBuilder()
    .setName(diceResultConfig.name)
    .setDescription(diceResultConfig.description)
    .addStringOption((option) =>
      option
        .setName('character')
        .setDescription('特定のキャラクターの履歴を表示（省略時は全キャラクター）')
        .setRequired(false)
    )

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!(await this.preExecute(interaction))) return
    if (!interaction.isChatInputCommand()) return

    try {
      await this.orchestrator.execute(interaction)
      await this.postExecute(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'ダイスロール履歴取得')
    }
  }
}
