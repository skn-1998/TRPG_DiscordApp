import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageCancelButtonService implements discordButtonType {
  public data = new ButtonBuilder().setCustomId('dice-cancel*').setLabel('cancel').setStyle(ButtonStyle.Danger)

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
      const success = this.paginationService.cancelPagination(channelId, messageId)
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
        await interaction.followUp({ content: '⚠️ ページネーションの状態が見つかりませんでした。', ephemeral: true })
      }
    } catch (error) {
      try {
        await interaction.followUp({ content: '⚠️ キャンセル処理中にエラーが発生しました。', ephemeral: true })
      } catch {}
    }
  }
}
