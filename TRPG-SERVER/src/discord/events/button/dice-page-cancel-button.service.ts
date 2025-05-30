import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageCancelButtonService implements discordButtonType {
  // ButtonBuilderのインスタンス
  public data = new ButtonBuilder().setCustomId('dice-cancel*').setLabel('cancel').setStyle(ButtonStyle.Danger)

  constructor(private readonly paginationService: DiceRollPaginationService) {}

  /**
   * キャンセルボタンがクリックされたときの処理
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

      // ページネーション状態を削除
      const success = this.paginationService.cancelPagination(channelId, messageId)

      if (success) {
        // メッセージを削除
        try {
          await interaction.deleteReply()
        } catch (deleteError) {
          console.error('メッセージ削除エラー:', deleteError)
          // 削除に失敗した場合はコンポーネントを無効化
          await interaction.editReply({
            content: 'ページネーションがキャンセルされました。',
            embeds: [],
            components: []
          })
        }
      } else {
        await interaction.followUp({
          content: '⚠️ ページネーションの状態が見つかりませんでした。',
          ephemeral: true
        })
      }
    } catch (error) {
      console.error('Error handling cancel button:', error)

      // エラー時のフォールバック
      try {
        await interaction.followUp({
          content: '⚠️ キャンセル処理中にエラーが発生しました。',
          ephemeral: true
        })
      } catch (replyError) {
        console.error('エラー応答の送信に失敗:', replyError)
      }
    }
  }
}
