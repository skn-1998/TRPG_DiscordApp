import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, MessageFlags } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { DicePageCustomId } from 'src/discord/features/diceRoll/custom-id'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageLastButtonService implements discordButtonType {
  public data = new ButtonBuilder()
    .setCustomId(DicePageCustomId.template('last'))
    .setLabel('>>')
    .setStyle(ButtonStyle.Secondary)

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
      const newPage = this.paginationService.updatePage(parsed.channelId, parsed.messageId, 'last')
      if (!newPage) {
        await interaction.followUp({ content: '既に最後のページです。', flags: MessageFlags.Ephemeral })
        return
      }
      const state = this.paginationService.getPaginationState(parsed.channelId, parsed.messageId)
      if (!state) {
        await interaction.followUp({
          content: '⚠️ ページ状態の取得に失敗しました。もう一度お試しください。',
          flags: MessageFlags.Ephemeral
        })
        return
      }
      const controls = await this.paginationService.createPaginationControls(
        parsed.messageId,
        parsed.channelId,
        state.totalPages
      )
      await interaction.editReply({ embeds: [newPage], components: controls })
    } catch {
      try {
        await interaction.followUp({
          content: '⚠️ ページめくりの処理中にエラーが発生しました。',
          flags: MessageFlags.Ephemeral
        })
      } catch {}
    }
  }
}
