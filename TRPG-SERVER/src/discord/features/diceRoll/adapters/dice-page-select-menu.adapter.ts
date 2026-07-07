import { Injectable } from '@nestjs/common'
import { StringSelectMenuBuilder, StringSelectMenuInteraction, CacheType, EmbedBuilder, MessageFlags } from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import { DicePageCustomId } from 'src/discord/features/diceRoll/custom-id'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageSelectMenuService implements discordSelectMenuType {
  public data = new StringSelectMenuBuilder()
    .setCustomId(DicePageCustomId.template('select'))
    .setPlaceholder('ページを選択')

  constructor(private readonly paginationService: DiceRollPaginationService) {}

  async execute(interaction: StringSelectMenuInteraction<CacheType>): Promise<void> {
    try {
      await interaction.deferUpdate()
      const parsed = DicePageCustomId.parse(interaction.customId)
      if (!parsed) {
        await interaction.followUp({
          content: '⚠️ メニューの処理中にエラーが発生しました。',
          flags: MessageFlags.Ephemeral
        })
        return
      }
      const selectedValue = interaction.values[0]
      if (!selectedValue) {
        await interaction.followUp({ content: '⚠️ 選択された値が無効です。', flags: MessageFlags.Ephemeral })
        return
      }
      let newPage: EmbedBuilder | null = null
      if (selectedValue === 'prev-25' || selectedValue === 'next-25') {
        await interaction.followUp({ content: 'この機能は現在開発中です。', flags: MessageFlags.Ephemeral })
        return
      }
      const pageNumber = parseInt(selectedValue, 10)
      if (isNaN(pageNumber)) {
        await interaction.followUp({ content: '⚠️ 無効なページ番号です。', flags: MessageFlags.Ephemeral })
        return
      }
      newPage = this.paginationService.jumpToPage(parsed.channelId, parsed.messageId, pageNumber)
      if (!newPage) {
        await interaction.followUp({
          content: '⚠️ 指定されたページに移動できませんでした。',
          flags: MessageFlags.Ephemeral
        })
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
          content: '⚠️ ページ選択の処理中にエラーが発生しました。',
          flags: MessageFlags.Ephemeral
        })
      } catch {}
    }
  }
}
