import { Logger } from '@nestjs/common'
import {
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  ModalSubmitInteraction,
  SelectMenuInteraction
} from 'discord.js'
import { ErrorContext, ErrorHandler } from '../../core/http/error-handler'
import { respondEphemeralError } from './interaction-error-response.util'

const DEFAULT_USER_MESSAGE = '⚠️ エラーが発生しました。もう一度お試しください。'

/**
 * Discord interaction のエラーを構造化ログへ記録し、応答状態に合う通知を送る。
 *
 * 通知失敗はログへ残して吸収し、caller へ例外を返さない。
 */
export class DiscordErrorReporter {
  private static readonly logger = new Logger(DiscordErrorReporter.name)

  /**
   * コマンドまたは autocomplete のエラーを報告する。
   *
   * autocomplete は respond([]) のみでユーザー可視通知なし。この早期 return が
   * respondEphemeralError への型ナローイングの根拠でもある（削除すると型が壊れる）。
   */
  static async handleDiscordCommandError(
    error: unknown,
    interaction: CommandInteraction | AutocompleteInteraction,
    context: ErrorContext,
    customMessage?: string
  ): Promise<void> {
    const errorMessage = this.extractErrorMessage(error)

    ErrorHandler.logError(
      error,
      {
        ...context,
        discordUserId: interaction.user.id,
        guildId: interaction.guild?.id,
        channelId: interaction.channel?.id
      },
      'DISCORD_BOT'
    )

    const userMessage = customMessage || DEFAULT_USER_MESSAGE

    try {
      if (interaction.isAutocomplete()) {
        await interaction.respond([])
        return
      }

      await respondEphemeralError(interaction, userMessage)
    } catch (replyError) {
      this.logger.error('Discord エラー応答に失敗', {
        originalError: errorMessage,
        replyError: this.extractErrorMessage(replyError)
      })
    }
  }

  /**
   * ボタン・モーダル・セレクトメニュー interaction のエラーを報告する。
   *
   * deferUpdate 由来の caller はこの関数を使わず、`respondEphemeralError` を
   * `deferredStrategy: 'followUp'` で直接呼び、共有メッセージを保持すること。
   */
  static async handleDiscordError(
    error: unknown,
    interaction: ButtonInteraction | ModalSubmitInteraction | SelectMenuInteraction,
    context: ErrorContext,
    customMessage?: string
  ): Promise<void> {
    const errorMessage = this.extractErrorMessage(error)

    ErrorHandler.logError(
      error,
      {
        ...context,
        discordUserId: interaction.user.id,
        guildId: interaction.guild?.id,
        channelId: interaction.channel?.id
      },
      'DISCORD_BOT'
    )

    const userMessage = customMessage || DEFAULT_USER_MESSAGE

    try {
      await respondEphemeralError(interaction, userMessage)
    } catch (replyError) {
      this.logger.error('Discord エラー応答に失敗', {
        originalError: errorMessage,
        replyError: this.extractErrorMessage(replyError),
        interactionId: interaction.id,
        userId: interaction.user.id
      })
    }
  }

  private static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }

    if (typeof error === 'string') {
      return error
    }

    return JSON.stringify(error) ?? String(error)
  }
}
