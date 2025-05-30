import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageLastButtonService implements discordButtonType {
  // ButtonBuilderのインスタンス
  public data = new ButtonBuilder().setCustomId('dice-last*').setLabel('>>').setStyle(ButtonStyle.Secondary)

  constructor(private readonly paginationService: DiceRollPaginationService) {}

  /**
   * 最後のページボタンがクリックされたときの処理
   */
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      // インタラクションの処理中を表示
      await interaction.deferUpdate()

      // カスタムIDからメッセージIDとチャンネルIDを抽出
      const customId = interaction.customId
      const [_, messageId, channelId] = customId.split('*')

      if (!messageId || !channelId) {
        console.error('Invalid customId format:', customId)
        await interaction.followUp({
          content: '⚠️ ボタンの処理中にエラーが発生しました。',
          ephemeral: true
        })
        return
      }

      // 最後のページを取得
      const newPage = this.paginationService.updatePage(channelId, messageId, 'last')
      if (!newPage) {
        // ページ更新に失敗した場合や変更がない場合は通知
        await interaction.followUp({
          content: '既に最後のページです。',
          ephemeral: true
        })
        return
      }

      // ページ状態を取得
      const state = this.paginationService.getPaginationState(channelId, messageId)
      if (!state) {
        console.error('ページ状態が見つかりませんでした')
        await interaction.followUp({
          content: '⚠️ ページ状態の取得に失敗しました。もう一度お試しください。',
          ephemeral: true
        })
        return
      }

      // ページネーションコントロールを更新
      const controls = await this.paginationService.createPaginationControls(messageId, channelId, state.totalPages)

      // メッセージを更新
      await interaction.editReply({
        embeds: [newPage],
        components: controls
      })
    } catch (error) {
      console.error('Error handling last page button:', error)

      // エラー時のフォールバック
      try {
        await interaction.followUp({
          content: '⚠️ ページめくりの処理中にエラーが発生しました。',
          ephemeral: true
        })
      } catch (replyError) {
        console.error('エラー応答の送信に失敗:', replyError)
      }
    }
  }
}
