import { Injectable } from '@nestjs/common'
import { ButtonInteraction, ChannelType, TextChannel } from 'discord.js'
import { ButtonInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { DiceRollLogicService } from 'src/discord/services/dice/dice-roll-logic.service'
import { DiceRollRequest } from 'src/discord/utils/dice-roll.interface'

/**
 * 汎用ダイスボタンハンドラー
 *
 * customId: dice_generic_{diceType}_{channelId}
 *
 * 例:
 *   - dice_generic_1d6_1234567890
 *   - dice_generic_2d6_1234567890
 *   - dice_generic_1d20_1234567890
 *   - dice_generic_1d100_1234567890
 */
@Injectable()
export class DiceGenericHandler extends ButtonInteractionHandler {
  constructor(private readonly diceRollLogicService: DiceRollLogicService) {
    super()
  }

  getCustomIdPattern(): string {
    return 'dice_generic_'
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    try {
      this.logger.debug(`Handling dice generic: ${interaction.customId}`)

      // customIdをパース: dice_generic_{diceType}_{channelId}
      const parts = interaction.customId.split('_')
      if (parts.length < 4) {
        this.logger.warn(`Invalid dice_generic customId format: ${interaction.customId}`)
        await interaction.reply({
          content: '❌ ダイスボタンの形式が不正です。',
          ephemeral: true
        })
        return
      }

      // dice_generic_1d6_channelId → diceType = 1d6, channelId = channelId
      const diceType = parts[2] // 1d6, 2d6, 1d20, 1d100
      const channelId = parts.slice(3).join('_') // チャンネルIDに_が含まれる場合を考慮

      // UIを更新せずに応答（スレッドには何も表示しない）
      await interaction.deferUpdate()

      // ダイスロールを実行
      const request: DiceRollRequest = {
        channelId,
        diceType,
        reason: `汎用ダイス (${diceType})`,
        userId: interaction.user.id
      }

      const result = await this.diceRollLogicService.handleDiceRoll(interaction, request)

      if (result.success) {
        // 親チャンネルに結果を送信
        await this.sendToParentChannel(interaction, result.details || `${result.diceType}: ${result.total}`)
      } else {
        // エラーの場合のみスレッドに通知（エフェメラル）
        await interaction.followUp({
          content: `❌ ダイスロールに失敗しました: ${result.error || '不明なエラー'}`,
          ephemeral: true
        })
      }
    } catch (error) {
      this.logger.error(`Failed to handle dice generic: ${interaction.customId}`, error)

      const errorMessage = error instanceof Error ? error.message : 'ダイスロール処理中にエラーが発生しました'

      try {
        await interaction.followUp({ content: `❌ ${errorMessage}`, ephemeral: true })
      } catch {
        // 応答失敗は無視
      }
    }
  }

  /**
   * 親チャンネルに結果を送信
   */
  private async sendToParentChannel(interaction: ButtonInteraction, message: string): Promise<boolean> {
    try {
      if (!interaction.channel) return false

      // スレッドチャンネルかチェック
      if (
        interaction.channel.type === ChannelType.PublicThread ||
        interaction.channel.type === ChannelType.PrivateThread
      ) {
        const parentId = interaction.channel.parentId
        if (parentId) {
          const parentChannel = await interaction.client.channels.fetch(parentId)
          if (parentChannel && parentChannel.isTextBased()) {
            await (parentChannel as TextChannel).send({ content: message })
            return true
          }
        }
      }
      return false
    } catch (error) {
      this.logger.warn('Failed to send result to parent channel', error)
      return false
    }
  }
}
