import { Injectable, Logger } from '@nestjs/common'
import { CommandInteraction, AutocompleteInteraction } from 'discord.js'
import { TypedEventService } from '../../core/events/typed-event.service'
import { DiscordErrorReporter } from '../utils/discord-error-reporter'

@Injectable()
export abstract class BaseCommandService {
  protected readonly logger: Logger

  constructor(
    protected readonly typedEventService: TypedEventService,
    loggerContext: string
  ) {
    this.logger = new Logger(loggerContext)
  }

  /**
   * 統一されたDiscordインタラクションエラーハンドリング
   */
  protected async handleInteractionError(
    interaction: CommandInteraction | AutocompleteInteraction,
    error: unknown,
    context: string
  ): Promise<void> {
    await DiscordErrorReporter.handleDiscordCommandError(error, interaction, {
      action: context,
      additionalData: { commandName: interaction.commandName }
    })
  }

  /**
   * 統一されたコマンド実行前処理
   */
  protected async preExecute(interaction: CommandInteraction): Promise<boolean> {
    if (!interaction.isChatInputCommand()) {
      this.logger.warn('Invalid interaction type received')
      return false
    }

    this.logger.debug(`Command executed: ${interaction.commandName}`, {
      userId: interaction.user.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId
    })

    return true
  }

  /**
   * 統一されたコマンド実行後処理
   */
  protected async postExecute(interaction: CommandInteraction): Promise<void> {
    this.logger.debug(`Command completed: ${interaction.commandName}`, {
      userId: interaction.user.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId
    })
  }

  /**
   * 統一されたチャンネル存在チェック
   */
  protected validateChannel(interaction: CommandInteraction): boolean {
    if (!interaction.channel) {
      this.logger.warn('Channel not found in interaction')
      return false
    }
    return true
  }

  /**
   * 統一されたギルド存在チェック
   */
  protected validateGuild(interaction: CommandInteraction): boolean {
    if (!interaction.guild) {
      this.logger.warn('Guild not found in interaction')
      return false
    }
    return true
  }
}
