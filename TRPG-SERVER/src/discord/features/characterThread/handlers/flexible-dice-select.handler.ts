import { Injectable } from '@nestjs/common'
import {
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  TextChannel,
  MessageFlags
} from 'discord.js'
import { SelectMenuInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { DiceRollLogicService } from 'src/discord/services/dice/dice-roll-logic.service'
import { DiceRollRequest } from 'src/discord/utils/dice-roll.interface'
// P1-D slice2: handler pattern を feature-local 契約モジュールへ集約（pattern 完全同一）
import { FlexibleDiceSelectCustomId } from '../custom-id'

/**
 * フレキシブルダイス選択ハンドラー
 *
 * customId: flexible_dice_{channelId}
 *
 * ダイスタイプを選択した後:
 * - 1d6, 2d6, 1d10, 1d20, 1d100 → 即座にダイスロール実行
 * - custom_dice → カスタムダイスモーダルを表示
 */
@Injectable()
export class FlexibleDiceSelectHandler extends SelectMenuInteractionHandler {
  constructor(private readonly diceRollLogicService: DiceRollLogicService) {
    super()
  }

  getCustomIdPattern(): string {
    return FlexibleDiceSelectCustomId.pattern
  }

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      this.logger.debug(`Handling flexible dice select: ${interaction.customId}`)

      // customIdからchannelIdを抽出
      const channelId = interaction.customId.replace('flexible_dice_', '')
      const selectedValue = interaction.values[0]

      this.logger.debug(`Flexible dice selection: value=${selectedValue}, channelId=${channelId}`)

      // カスタムダイスの場合はモーダルを表示
      if (selectedValue === 'custom_dice') {
        await this.showCustomDiceModal(interaction, channelId)
        return
      }

      // UIを更新せずに応答（スレッドには何も表示しない）
      await interaction.deferUpdate()

      const request: DiceRollRequest = {
        channelId,
        diceType: selectedValue,
        reason: `フレキシブルダイス (${selectedValue})`,
        userId: interaction.user.id
      }

      const result = await this.diceRollLogicService.handleDiceRoll(
        interaction as any, // ButtonInteractionとして渡す（互換性のため）
        request
      )

      if (result.success) {
        // 親チャンネルに結果を送信
        await this.sendToParentChannel(interaction, result.details || `${result.diceType}: ${result.total}`)
      } else {
        // エラーの場合のみスレッドに通知（エフェメラル）
        await interaction.followUp({
          content: `❌ ダイスロールに失敗しました: ${result.error || '不明なエラー'}`,
          flags: MessageFlags.Ephemeral
        })
      }
    } catch (error) {
      this.logger.error(`Failed to handle flexible dice select: ${interaction.customId}`, error)

      const errorMessage = error instanceof Error ? error.message : 'ダイスロール処理中にエラーが発生しました'

      try {
        await interaction.followUp({ content: `❌ ${errorMessage}`, flags: MessageFlags.Ephemeral })
      } catch {
        // 応答失敗は無視
      }
    }
  }

  /**
   * カスタムダイスモーダルを表示
   */
  private async showCustomDiceModal(interaction: StringSelectMenuInteraction, channelId: string): Promise<void> {
    const modal = new ModalBuilder().setCustomId(`custom-dice-modal*${channelId}`).setTitle('🎲 カスタムダイス')

    const diceInput = new TextInputBuilder()
      .setCustomId('dice-command')
      .setLabel('ダイス式')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 2d6+3, 1d20+5, 3d8')
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(50)

    const reasonInput = new TextInputBuilder()
      // S-2: 受け手 CustomDiceModalService は `dice-comment` を読む。`dice-reason` だと
      // getTextInputValue('dice-comment') が throw して送信が失敗するため canonical 名に統一。
      .setCustomId('dice-comment')
      .setLabel('理由（任意）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 攻撃判定、ダメージロール')
      .setRequired(false)
      .setMaxLength(100)

    const diceRow = new ActionRowBuilder<TextInputBuilder>().addComponents(diceInput)
    const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)

    modal.addComponents(diceRow, reasonRow)

    await interaction.showModal(modal)
  }

  /**
   * 親チャンネルに結果を送信
   */
  private async sendToParentChannel(interaction: StringSelectMenuInteraction, message: string): Promise<boolean> {
    try {
      if (!interaction.channel) return false

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
