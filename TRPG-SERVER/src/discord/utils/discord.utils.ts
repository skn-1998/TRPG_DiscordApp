import { CommandInteraction } from 'discord.js'

export async function handleError(interaction: CommandInteraction, error: unknown): Promise<void> {
  try {
    if (error instanceof Error) {
      console.error('エラーが発生しました:', error.message)

      const errorMessage = 'エラーが発生しました: ' + error.message

      if (!interaction.isRepliable()) {
        console.error('インタラクションは応答不可能な状態です')
        return
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true })
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true })
      }
    } else {
      console.error('未知のエラーが発生しました')

      const errorMessage = '未知のエラーが発生しました。もう一度お試しください。'

      if (!interaction.isRepliable()) {
        console.error('インタラクションは応答不可能な状態です')
        return
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true })
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true })
      }
    }
  } catch (replyError) {
    console.error('エラー応答中にさらにエラーが発生しました:', replyError)
  }
}
