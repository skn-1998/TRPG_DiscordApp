import { Injectable } from '@nestjs/common'
import { ButtonInteraction, ChannelType, TextChannel } from 'discord.js'
import { ButtonInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { DiceRollLogicService } from 'src/discord/services/dice/dice-roll-logic.service'
import { CharacterService } from 'src/domains/character/character.service'
import { AbilityRollCustomId } from '../custom-id'
import { resolveAbilityRoll } from '../services/ability-roll.util'

/**
 * 能力(ability)ロールボタンハンドラー（S-3・customId 統合 案2）
 *
 * customId: `ability_{channelId}_{abilityKey}`
 *
 * skill_ ロール（CharacterSkillRollHandler）と完全同型。能力値は character.parameter
 * （skill と同型 AttributeSection）から再解決する。能力ロールも「名前+値の判定」のため、
 * skill と同一の `DiceRollLogicService.handleSkillRoll` を再利用する（新メソッドは作らない）。
 * 挙動は CharacterSkillRollHandler と同型（deferUpdate → 実行 → 親チャンネルへ結果投稿）。
 */
@Injectable()
export class AbilityRollHandler extends ButtonInteractionHandler {
  constructor(
    private readonly diceRollLogicService: DiceRollLogicService,
    private readonly characterService: CharacterService
  ) {
    super()
  }

  getCustomIdPattern(): string {
    return AbilityRollCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    try {
      this.logger.debug(`Handling ability roll: ${interaction.customId}`)

      const parsed = AbilityRollCustomId.parse(interaction.customId)
      if (!parsed) {
        this.logger.warn(`Invalid ability roll customId format: ${interaction.customId}`)
        await interaction.reply({ content: '❌ 能力ボタンの形式が不正です。', ephemeral: true })
        return
      }

      // UI は更新せず応答（スレッドには何も表示しない）
      await interaction.deferUpdate()

      const character = await this.characterService.findByChannelId(parsed.channelId)
      if (!character) {
        await interaction.followUp({ content: '❌ キャラクターが見つかりません。', ephemeral: true })
        return
      }

      const resolved = resolveAbilityRoll(character, parsed.abilityKey)
      if (!resolved) {
        // ability が存在しない → 目標値 0 の誤ロール＋DB 保存を避けてエラー応答
        await interaction.followUp({ content: '❌ 能力値が見つかりません。', ephemeral: true })
        return
      }
      const { abilityName, abilityValue } = resolved

      const result = await this.diceRollLogicService.handleSkillRoll(
        interaction,
        parsed.channelId,
        abilityName,
        abilityValue
      )

      if (result.success) {
        // 親チャンネルに結果を送信
        const posted = await this.sendToParentChannel(interaction, result.details || `${abilityName}(${abilityValue})`)
        if (!posted) {
          // スレッド外 / 親チャンネル取得不可で投稿できなかった場合の fallback 通知
          await interaction.followUp({
            content: '❌ 結果を親チャンネルへ送信できませんでした。',
            ephemeral: true
          })
        }
      } else {
        // エラーの場合のみスレッドに通知（エフェメラル）
        await interaction.followUp({
          content: `❌ 能力ロールに失敗しました: ${result.error || '不明なエラー'}`,
          ephemeral: true
        })
      }
    } catch (error) {
      this.logger.error(`Failed to handle ability roll: ${interaction.customId}`, error)

      const errorMessage = error instanceof Error ? error.message : '能力ロール処理中にエラーが発生しました'

      try {
        await interaction.followUp({ content: `❌ ${errorMessage}`, ephemeral: true })
      } catch {
        // 応答失敗は無視
      }
    }
  }

  /**
   * 親チャンネルに結果を送信（CharacterSkillRollHandler と同一ロジック）
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
