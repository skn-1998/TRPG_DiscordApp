import { Injectable } from '@nestjs/common'
import { StringSelectMenuBuilder, StringSelectMenuInteraction, CacheType, EmbedBuilder } from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'

@Injectable()
export class DicePageSelectMenuService implements discordSelectMenuType {
  // StringSelectMenuBuilderのインスタンス
  public data = new StringSelectMenuBuilder().setCustomId('dice-page-select*').setPlaceholder('ページを選択')

  constructor(private readonly paginationService: DiceRollPaginationService) {}

  /**
   * ページ選択メニューが選択されたときの処理
   */
  async execute(interaction: StringSelectMenuInteraction<CacheType>): Promise<void> {
    try {
      // インタラクションの処理中を表示
      await interaction.deferUpdate()

      // カスタムIDからメッセージIDとチャンネルIDを抽出
      const customId = interaction.customId
      const [_, messageId, channelId] = customId.split('*')

      if (!messageId || !channelId) {
        console.error('Invalid customId format:', customId)
        await interaction.followUp({
          content: '⚠️ メニューの処理中にエラーが発生しました。',
          ephemeral: true
        })
        return
      }

      // 選択された値を取得
      const selectedValue = interaction.values[0]
      if (!selectedValue) {
        await interaction.followUp({
          content: '⚠️ 選択された値が無効です。',
          ephemeral: true
        })
        return
      }

      let newPage: EmbedBuilder | null = null

      // 特別な値の処理
      if (selectedValue === 'prev-25' || selectedValue === 'next-25') {
        // TODO: 25ページ単位の移動処理（必要に応じて実装）
        await interaction.followUp({
          content: 'この機能は現在開発中です。',
          ephemeral: true
        })
        return
      }

      // 通常のページ番号の場合
      const pageNumber = parseInt(selectedValue, 10)
      if (isNaN(pageNumber)) {
        await interaction.followUp({
          content: '⚠️ 無効なページ番号です。',
          ephemeral: true
        })
        return
      }

      // 指定されたページに移動
      newPage = this.paginationService.jumpToPage(channelId, messageId, pageNumber)
      if (!newPage) {
        await interaction.followUp({
          content: '⚠️ 指定されたページに移動できませんでした。',
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
      console.error('Error handling page select menu:', error)

      // エラー時のフォールバック
      try {
        await interaction.followUp({
          content: '⚠️ ページ選択の処理中にエラーが発生しました。',
          ephemeral: true
        })
      } catch (replyError) {
        console.error('エラー応答の送信に失敗:', replyError)
      }
    }
  }
}
