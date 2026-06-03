import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageFirstButtonService implements discordButtonType {
  public data = new ButtonBuilder().setCustomId('dice-first*').setLabel('<<').setStyle(ButtonStyle.Secondary)

  constructor(private readonly paginationService: DiceRollPaginationService) {}

  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      await interaction.deferUpdate()
      const customId = interaction.customId
      const [_, messageId, channelId] = customId.split('*')
      if (!messageId || !channelId) {
        await interaction.followUp({ content: '⚠️ ボタンの処理中にエラーが発生しました。', ephemeral: true })
        return
      }
      const newPage = this.paginationService.updatePage(channelId, messageId, 'first')
      if (!newPage) {
        await interaction.followUp({ content: '既に最初のページです。', ephemeral: true })
        return
      }
      const state = this.paginationService.getPaginationState(channelId, messageId)
      if (!state) {
        await interaction.followUp({
          content: '⚠️ ページ状態の取得に失敗しました。もう一度お試しください。',
          ephemeral: true
        })
        return
      }
      const controls = await this.paginationService.createPaginationControls(messageId, channelId, state.totalPages)
      await interaction.editReply({ embeds: [newPage], components: controls })
    } catch {
      try {
        await interaction.followUp({ content: '⚠️ ページめくりの処理中にエラーが発生しました。', ephemeral: true })
      } catch {}
    }
  }
}
