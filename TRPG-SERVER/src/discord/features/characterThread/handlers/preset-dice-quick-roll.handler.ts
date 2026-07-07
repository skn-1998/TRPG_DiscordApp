import { Injectable } from '@nestjs/common'
import { ButtonInteraction, ChannelType, TextChannel, MessageFlags } from 'discord.js'
import { ButtonInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { DiceRollLogicService } from 'src/discord/services/dice/dice-roll-logic.service'
import { DiceRollRequest } from 'src/discord/utils/dice-roll.interface'
import { PresetDiceCustomId, resolvePresetDiceRoll } from '../custom-id'

/**
 * プリセットダイス（system 別クイックロール）ハンドラー（P1-D 後続・方針A 最小機能化）
 *
 * customId: `dice_{system}_{action}_{channelId}`（system: coc7/dnd5e/sw25・postPresetDiceButtons が送出）
 *
 * 経緯: これら preset ボタンは実送出されるが従来 registry 未対応で未routing（クリックで「現在処理できません」）だった。
 * 専用ゲームルール（SAN 値比較・武器ダメージ式等）は未実装かつ findByChannelId が stats 非返却のため、
 * 暫定として **system 既定 notation を振り action をラベル化**して機能させる（DiceGenericHandler と同型）。
 * 完全なルール実装は次フェーズ。
 */
@Injectable()
export class PresetDiceQuickRollHandler extends ButtonInteractionHandler {
  constructor(private readonly diceRollLogicService: DiceRollLogicService) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return PresetDiceCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    try {
      this.logger.debug(`Handling preset dice: ${interaction.customId}`)

      const parsed = PresetDiceCustomId.parse(interaction.customId)
      if (!parsed) {
        this.logger.warn(`Invalid preset dice customId format: ${interaction.customId}`)
        await interaction.reply({ content: '❌ プリセットダイスの形式が不正です。', flags: MessageFlags.Ephemeral })
        return
      }

      // UI は更新せず応答（スレッドには何も表示しない）
      await interaction.deferUpdate()

      const { notation, reason } = resolvePresetDiceRoll(parsed.system, parsed.action)

      const request: DiceRollRequest = {
        channelId: parsed.channelId,
        diceType: notation,
        reason,
        userId: interaction.user.id
      }

      const result = await this.diceRollLogicService.handleDiceRoll(interaction, request)

      if (result.success) {
        const posted = await this.sendToParentChannel(interaction, result.details || `${reason}: ${result.total}`)
        if (!posted) {
          await interaction.followUp({
            content: '❌ 結果を親チャンネルへ送信できませんでした。',
            flags: MessageFlags.Ephemeral
          })
        }
      } else {
        await interaction.followUp({
          content: `❌ ダイスロールに失敗しました: ${result.error || '不明なエラー'}`,
          flags: MessageFlags.Ephemeral
        })
      }
    } catch (error) {
      this.logger.error(`Failed to handle preset dice: ${interaction.customId}`, error)

      const errorMessage = error instanceof Error ? error.message : 'ダイスロール処理中にエラーが発生しました'

      try {
        await interaction.followUp({ content: `❌ ${errorMessage}`, flags: MessageFlags.Ephemeral })
      } catch {
        // 応答失敗は無視
      }
    }
  }

  /**
   * 親チャンネルに結果を送信（DiceGenericHandler / CharacterSkillRollHandler と同一ロジック）
   */
  private async sendToParentChannel(interaction: ButtonInteraction, message: string): Promise<boolean> {
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
