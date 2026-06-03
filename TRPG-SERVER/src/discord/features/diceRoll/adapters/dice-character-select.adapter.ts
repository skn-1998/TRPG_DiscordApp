import { Injectable } from '@nestjs/common'
import { AnySelectMenuInteraction, CacheType, StringSelectMenuBuilder } from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import { DiceRollPaginationService } from 'src/discord/features/diceRoll/services/pagination/dice-roll-pagination.service'

@Injectable()
export class DiceCharacterSelectService implements discordSelectMenuType {
  public data = new StringSelectMenuBuilder().setCustomId('dice-char-select*').setPlaceholder('キャラクターを選択')

  constructor(private readonly paginationService: DiceRollPaginationService) {}

  async execute(interaction: AnySelectMenuInteraction<CacheType>): Promise<void> {
    try {
      if (!interaction.isStringSelectMenu()) return
      await interaction.deferUpdate()
      const customId = interaction.customId
      const [_, messageId, channelId] = customId.split('*')
      if (!messageId || !channelId) {
        await interaction.followUp({ content: '⚠️ 選択メニューの処理中にエラーが発生しました。', ephemeral: true })
        return
      }
      const selectedCharacterId = interaction.values[0]
      const newState = await this.paginationService.updateCharacter(channelId, messageId, selectedCharacterId)
      if (!newState || newState.pages.length === 0) {
        await interaction.followUp({ content: `⚠️ 履歴が見つかりませんでした。`, ephemeral: true })
        return
      }
      const controls = await this.paginationService.createPaginationControls(messageId, channelId, newState.totalPages)
      await interaction.editReply({ embeds: [newState.pages[0]], components: controls })
    } catch {
      try {
        await interaction.followUp({ content: '⚠️ キャラクター選択の処理中にエラーが発生しました。', ephemeral: true })
      } catch {}
    }
  }
}
