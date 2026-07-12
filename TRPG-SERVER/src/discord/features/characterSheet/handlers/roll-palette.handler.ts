import { Injectable } from '@nestjs/common'
import { ButtonInteraction, MessageFlags } from 'discord.js'
import { CharacterService } from '../../../../domains/character/character.service'
import { ButtonInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { DiceRollLogicService } from '../../../services/dice/dice-roll-logic.service'
import { postRollResultToParentChannel } from '../adapters/parent-channel-result.adapter'
import { RollPaletteCustomId } from '../custom-id'

@Injectable()
export class RollPaletteHandler extends ButtonInteractionHandler {
  constructor(
    private readonly characterService: CharacterService,
    private readonly diceRollLogicService: DiceRollLogicService
  ) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return RollPaletteCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    const parsed = RollPaletteCustomId.parse(interaction.customId)
    if (parsed === null) {
      await interaction.reply({ content: '❌ ボタンの形式が不正です。', flags: MessageFlags.Ephemeral })
      return
    }

    await interaction.deferUpdate()

    try {
      const character = await this.characterService.findByChannelId(parsed.channelId)
      const entry = character?.palette?.find((candidate) => candidate.key === parsed.key)
      if (entry === undefined || entry.kind !== 'roll') {
        await interaction.followUp({ content: '❌ 該当エントリなし', flags: MessageFlags.Ephemeral })
        return
      }

      // ロールは参加者全員可。ここでは所有者検証を行わない。
      const result = await this.diceRollLogicService.executeCustomDiceRoll(
        entry.notation,
        entry.label,
        character?.characterName || 'Unknown'
      )

      if (!result.success) {
        await interaction.followUp({ content: '❌ ロールに失敗しました。', flags: MessageFlags.Ephemeral })
        return
      }

      try {
        await this.diceRollLogicService.saveCustomDiceRollHistory(
          interaction,
          parsed.channelId,
          result,
          character?.gameSystemId || 'custom'
        )
      } catch (error) {
        this.logger.error(`Failed to save palette roll history: ${interaction.customId}`, error)
      }

      const posted = await postRollResultToParentChannel(interaction, result.details || entry.label, this.logger)
      if (!posted) {
        await interaction.followUp({
          content: '❌ 結果を親チャンネルへ送信できませんでした。',
          flags: MessageFlags.Ephemeral
        })
      }
    } catch (error) {
      this.logger.error(`Failed to execute palette roll: ${interaction.customId}`, error)
      await interaction.followUp({ content: '❌ ロール処理に失敗しました。', flags: MessageFlags.Ephemeral })
    }
  }
}
