import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, MessageFlags } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { DicePageCustomId } from 'src/discord/features/diceRoll/custom-id'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageCancelButtonService implements discordButtonType {
  public data = new ButtonBuilder()
    .setCustomId(DicePageCustomId.template('cancel'))
    .setLabel('cancel')
    .setStyle(ButtonStyle.Danger)

  constructor(private readonly paginationService: DiceRollPaginationService) {}

  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      await interaction.deferUpdate()
      const parsed = DicePageCustomId.parse(interaction.customId)
      if (!parsed) {
        await interaction.followUp({
          content: '⚠️ ボタンの処理中にエラーが発生しました。',
          flags: MessageFlags.Ephemeral
        })
        return
      }
      const success = this.paginationService.cancelPagination(parsed.channelId, parsed.messageId)
      if (success) {
        try {
          await interaction.deleteReply()
        } catch {
          await interaction.editReply({
            content: 'ページネーションがキャンセルされました。',
            embeds: [],
            components: []
          })
        }
      } else {
        await interaction.followUp({
          content: '⚠️ ページネーションの状態が見つかりませんでした。',
          flags: MessageFlags.Ephemeral
        })
      }
    } catch {
      try {
        await interaction.followUp({
          content: '⚠️ キャンセル処理中にエラーが発生しました。',
          flags: MessageFlags.Ephemeral
        })
      } catch {}
    }
  }
}
