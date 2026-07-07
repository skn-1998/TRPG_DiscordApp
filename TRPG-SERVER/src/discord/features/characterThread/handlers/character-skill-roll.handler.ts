import { Injectable } from '@nestjs/common'
import { ButtonInteraction, MessageFlags } from 'discord.js'
import { ButtonInteractionHandler } from 'src/discord/interactions/handlers/base/interaction-handler.base'
import { DiceRollLogicService } from 'src/discord/services/dice/dice-roll-logic.service'
import { CharacterService } from 'src/domains/character/character.service'
import { SkillRollCustomId } from '../custom-id'
import { sendToParentChannel } from '../services/parent-channel.util'
import { resolveSkillRoll } from '../services/skill-roll.util'

/**
 * スキルロールボタンハンドラー（P1-D slice2・未routing latent bug の修正）
 *
 * customId: `skill_{channelId}_{skillKey}`（postSkillRollButtons が送出）
 *
 * 経緯: 本ボタンは実送出されるが従来 registry に対応 handler が無く未routing だった
 * （クリックで「現在処理できません」）。本 handler で `DiceRollLogicService.handleSkillRoll`
 * へ配線し機能させる。挙動は DiceGenericHandler と同型（deferUpdate → 実行 → 親チャンネルへ結果投稿）。
 */
@Injectable()
export class CharacterSkillRollHandler extends ButtonInteractionHandler {
  constructor(
    private readonly diceRollLogicService: DiceRollLogicService,
    private readonly characterService: CharacterService
  ) {
    super()
  }

  getCustomIdPattern(): string {
    return SkillRollCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    try {
      this.logger.debug(`Handling skill roll: ${interaction.customId}`)

      const parsed = SkillRollCustomId.parse(interaction.customId)
      if (!parsed) {
        this.logger.warn(`Invalid skill roll customId format: ${interaction.customId}`)
        await interaction.reply({ content: '❌ スキルボタンの形式が不正です。', flags: MessageFlags.Ephemeral })
        return
      }

      // UI は更新せず応答（スレッドには何も表示しない）
      await interaction.deferUpdate()

      const character = await this.characterService.findByChannelId(parsed.channelId)
      if (!character) {
        await interaction.followUp({ content: '❌ キャラクターが見つかりません。', flags: MessageFlags.Ephemeral })
        return
      }

      const resolved = resolveSkillRoll(character, parsed.skillKey)
      if (!resolved) {
        // skill が存在しない → 目標値 0 の誤ロール＋DB 保存を避けてエラー応答
        await interaction.followUp({ content: '❌ スキルが見つかりません。', flags: MessageFlags.Ephemeral })
        return
      }
      const { skillName, skillValue } = resolved

      const result = await this.diceRollLogicService.handleSkillRoll(
        interaction,
        parsed.channelId,
        skillName,
        skillValue
      )

      if (result.success) {
        // 親チャンネルに結果を送信（C-4: 共通ヘルパ・logger は handler context を保存）
        const posted = await sendToParentChannel(
          interaction,
          result.details || `${skillName}(${skillValue})`,
          this.logger
        )
        if (!posted) {
          // スレッド外 / 親チャンネル取得不可で投稿できなかった場合の fallback 通知
          await interaction.followUp({
            content: '❌ 結果を親チャンネルへ送信できませんでした。',
            flags: MessageFlags.Ephemeral
          })
        }
      } else {
        // エラーの場合のみスレッドに通知（エフェメラル）
        await interaction.followUp({
          content: `❌ スキルロールに失敗しました: ${result.error || '不明なエラー'}`,
          flags: MessageFlags.Ephemeral
        })
      }
    } catch (error) {
      this.logger.error(`Failed to handle skill roll: ${interaction.customId}`, error)

      const errorMessage = error instanceof Error ? error.message : 'スキルロール処理中にエラーが発生しました'

      try {
        await interaction.followUp({ content: `❌ ${errorMessage}`, flags: MessageFlags.Ephemeral })
      } catch {
        // 応答失敗は無視
      }
    }
  }
}
