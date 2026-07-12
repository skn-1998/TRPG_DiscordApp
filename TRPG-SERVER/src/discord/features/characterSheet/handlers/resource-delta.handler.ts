import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { ButtonInteraction, MessageFlags } from 'discord.js'
import { CharacterService } from '../../../../domains/character/character.service'
import { CharacterSheetOperationService } from '../../../../features/character-sheet/services/character-sheet-operation.service'
import { ButtonInteractionHandler } from '../../../interactions/handlers/base/interaction-handler.base'
import { ResourceDeltaCustomId } from '../custom-id'
import { HubRefreshWorker } from '../services/hub-refresh.worker'

@Injectable()
export class ResourceDeltaHandler extends ButtonInteractionHandler {
  constructor(
    private readonly characterService: CharacterService,
    private readonly characterSheetOperationService: CharacterSheetOperationService,
    @Optional() private readonly hubRefreshWorker?: HubRefreshWorker
  ) {
    super()
  }

  getCustomIdPattern(): RegExp {
    return ResourceDeltaCustomId.pattern
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    const parsed = ResourceDeltaCustomId.parse(interaction.customId)
    if (parsed === null) {
      await interaction.reply({ content: '❌ ボタンの形式が不正です。', flags: MessageFlags.Ephemeral })
      return
    }

    // OP-2: Discord の3秒制約に対し、DB参照・所有者検証より先に ack する。
    await interaction.deferUpdate()

    try {
      const character = await this.characterService.findByChannelId(parsed.channelId)
      if (character === null) {
        await interaction.followUp({ content: '❌ 該当エントリなし', flags: MessageFlags.Ephemeral })
        return
      }
      if (character.discordUserId !== interaction.user.id) {
        await interaction.followUp({
          content: '❌ この操作はキャラクターの所有者のみ実行できます。',
          flags: MessageFlags.Ephemeral
        })
        return
      }

      const result = await this.characterSheetOperationService.applyResourceDelta({
        channelId: parsed.channelId,
        paletteKey: parsed.key,
        delta: parsed.delta,
        interaction: { id: interaction.id }
      })
      this.hubRefreshWorker?.wake(result.character.characterId)

      let content: string
      if (result.noOp) {
        content = '✅ この操作は処理済みです。'
      } else if (result.clamped) {
        content = parsed.delta >= 0 ? 'ℹ️ 上限です。' : 'ℹ️ 下限です。'
      } else {
        const sign = result.effectiveDelta >= 0 ? '+' : ''
        content = `✅ リソースを ${sign}${result.effectiveDelta} 更新しました。`
      }
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral })
    } catch (error) {
      if (error instanceof NotFoundException) {
        await interaction.followUp({ content: '❌ 該当エントリなし', flags: MessageFlags.Ephemeral })
        return
      }
      if (this.isRetryBudgetConflict(error)) {
        this.logger.warn(`Resource delta retry budget exceeded: ${interaction.customId}`)
        await interaction.followUp({
          content: '⚠️ 混み合っています。少し待ってから再試行してください。',
          flags: MessageFlags.Ephemeral
        })
        return
      }

      this.logger.error(`Failed to apply resource delta: ${interaction.customId}`, error)
      await interaction.followUp({
        content: '❌ リソースの更新に失敗しました。',
        flags: MessageFlags.Ephemeral
      })
    }
  }

  private isRetryBudgetConflict(error: unknown): boolean {
    if (!(error instanceof ConflictException)) return false
    const response = error.getResponse()
    return typeof response === 'object' && response !== null && 'refetchRequired' in response
  }
}
