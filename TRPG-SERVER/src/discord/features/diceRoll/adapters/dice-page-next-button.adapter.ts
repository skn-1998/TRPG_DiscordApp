import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageNextButtonService implements discordButtonType {
  public data = new ButtonBuilder().setCustomId('dice-next*').setLabel('>').setStyle(ButtonStyle.Secondary)

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
      const newPage = this.paginationService.updatePage(channelId, messageId, 'next')
      if (!newPage) {
        await interaction.followUp({ content: '最後のページです。これ以上先のページはありません。', ephemeral: true })
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
