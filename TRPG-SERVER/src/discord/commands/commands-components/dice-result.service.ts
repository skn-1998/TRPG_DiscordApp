import { Injectable } from '@nestjs/common'
import { discordCommandType } from 'src/discord/discord.type'
import { SlashCommandBuilder, CommandInteraction } from 'discord.js'
import { diceResultConfig } from 'src/discord/commands/commands.list'
import {
  DiceRollPaginationService,
  PaginatedDiceRoll
} from 'src/discord/components/pagination/dice-roll-pagination.service'

@Injectable()
export class DiceResultService implements discordCommandType {
  constructor(private readonly diceRollPaginationService: DiceRollPaginationService) {}
  public data = new SlashCommandBuilder()
    .setName(diceResultConfig.name)
    .setDescription(diceResultConfig.description)
    .addStringOption((option) =>
      option
        .setName('character')
        .setDescription('特定のキャラクターの履歴を表示（省略時は全キャラクター）')
        .setRequired(false)
    )

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return

    try {
      // インタラクションを遅延応答に設定
      await interaction.deferReply()

      // チャンネルIDを取得
      const channelId = interaction.channelId
      if (!channelId) {
        await interaction.editReply({
          content: '⚠️ チャンネル情報を取得できませんでした。'
        })
        return
      }

      // キャラクターオプションを取得（省略可能）
      const characterOption = interaction.options.getString('character')

      // ページネーション用のEmbedを作成
      const pages = await this.diceRollPaginationService.createPaginatedEmbeds(channelId, characterOption || undefined)

      if (!pages || pages.length === 0) {
        await interaction.editReply({
          content: 'ダイスロール履歴がありません。'
        })
        return
      }

      // 応答メッセージを送信して、メッセージIDを取得
      const reply = await interaction.editReply({
        embeds: [pages[0]],
        components: [] // 一時的に空のコンポーネント
      })

      // メッセージIDを取得
      const messageId = reply.id

      // ページネーション状態を保存
      const paginationState: PaginatedDiceRoll = {
        pages,
        totalPages: pages.length,
        currentPage: 0,
        characterId: characterOption || undefined,
        messageId
      }
      this.diceRollPaginationService.savePaginationState(channelId, messageId, paginationState)

      // ページネーションコントロールを作成
      const controls = await this.diceRollPaginationService.createPaginationControls(messageId, channelId, pages.length)

      // コントロール付きでメッセージを更新
      await interaction.editReply({
        embeds: [pages[0]],
        components: controls
      })
    } catch (error) {
      console.error('DiceResultService実行エラー:', error)

      // エラー時の応答
      const errorMessage = '⚠️ ダイスロール履歴の取得中にエラーが発生しました。'

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage })
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true })
      }
    }
  }
}
