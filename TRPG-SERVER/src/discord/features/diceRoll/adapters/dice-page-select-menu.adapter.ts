import { Injectable } from '@nestjs/common'
import { StringSelectMenuBuilder, StringSelectMenuInteraction, CacheType, EmbedBuilder } from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageSelectMenuService implements discordSelectMenuType {
  public data = new StringSelectMenuBuilder().setCustomId('dice-page-select*').setPlaceholder('ページを選択')

  constructor(private readonly paginationService: DiceRollPaginationService) {}

  async execute(interaction: StringSelectMenuInteraction<CacheType>): Promise<void> {
    try {
      await interaction.deferUpdate()
      const customId = interaction.customId
      const [_, messageId, channelId] = customId.split('*')
      if (!messageId || !channelId) {
        await interaction.followUp({ content: '⚠️ メニューの処理中にエラーが発生しました。', ephemeral: true })
        return
      }
      const selectedValue = interaction.values[0]
      if (!selectedValue) {
        await interaction.followUp({ content: '⚠️ 選択された値が無効です。', ephemeral: true })
        return
      }
      let newPage: EmbedBuilder | null = null
      if (selectedValue === 'prev-25' || selectedValue === 'next-25') {
        await interaction.followUp({ content: 'この機能は現在開発中です。', ephemeral: true })
        return
      }
      const pageNumber = parseInt(selectedValue, 10)
      if (isNaN(pageNumber)) {
        await interaction.followUp({ content: '⚠️ 無効なページ番号です。', ephemeral: true })
        return
      }
      newPage = this.paginationService.jumpToPage(channelId, messageId, pageNumber)
      if (!newPage) {
        await interaction.followUp({ content: '⚠️ 指定されたページに移動できませんでした。', ephemeral: true })
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
        await interaction.followUp({ content: '⚠️ ページ選択の処理中にエラーが発生しました。', ephemeral: true })
      } catch {}
    }
  }
}
