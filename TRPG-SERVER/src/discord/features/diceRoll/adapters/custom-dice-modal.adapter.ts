import { Injectable } from '@nestjs/common'
import { ModalBuilder, ModalSubmitInteraction, CacheType } from 'discord.js'
import { discordModalType } from 'src/discord/discord.type'
import dice from 'src/discord/utils/dice'

@Injectable()
export class CustomDiceModalService implements discordModalType {
  public data = new ModalBuilder().setCustomId('custom-dice-modal').setTitle('カスタムダイスロール')

  async execute(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    try {
      const diceCommand = interaction.fields.getTextInputValue('dice-command')
      const comment = interaction.fields.getTextInputValue('dice-comment')

      const validDiceCommand = this.validateDiceCommand(diceCommand)
      if (!validDiceCommand) {
        await interaction.reply({
          content: '無効なダイスコマンドです。正しい形式（例: 1d100, 2d6+3）で入力してください。',
          ephemeral: true
        })
        return
      }

      const diceResult = await dice(validDiceCommand)
      if (!diceResult || !diceResult.text) {
        await interaction.reply({
          content: 'ダイスロールに失敗しました。別のコマンドを試してください。',
          ephemeral: true
        })
        return
      }

      let resultMessage = diceResult.text
      if (comment && comment.trim() !== '') {
        resultMessage = `【${comment}】 ${resultMessage}`
      }
      await interaction.reply({ content: resultMessage })
    } catch (error) {
      if (!interaction.replied) {
        await interaction.reply({ content: 'エラーが発生しました。もう一度お試しください。', ephemeral: true })
      }
    }
  }

  private validateDiceCommand(command: string): string | null {
    const dicePattern = /^\s*(\d+)[dD](\d+)([\+\-]\d+)?\s*$/
    const match = command.match(dicePattern)
    if (!match) return null
    const numDice = parseInt(match[1], 10)
    const diceSize = parseInt(match[2], 10)
    const modifier = match[3] || ''
    if (numDice > 100 || diceSize > 1000) return null
    return `${numDice}d${diceSize}${modifier}`
  }
}
