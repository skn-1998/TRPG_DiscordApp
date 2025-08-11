import { Injectable, Logger } from '@nestjs/common'
import { AnySelectMenuInteraction, CacheType, StringSelectMenuBuilder } from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import { CharacterThreadOrchestrator } from '../../features/characterThread/services'

@Injectable()
export class CharacterThreadSelectService implements discordSelectMenuType {
  private readonly logger = new Logger(CharacterThreadSelectService.name)

  // メニューの基本設定（実際のインスタンスは動的に生成される）
  public data = new StringSelectMenuBuilder()
    .setCustomId('character-thread-select')
    .setPlaceholder('キャラクターを選択')

  constructor(private readonly orchestrator: CharacterThreadOrchestrator) {}

  /**
   * キャラクタースレッド選択メニューが操作されたときの処理
   */
  async execute(interaction: AnySelectMenuInteraction<CacheType>): Promise<void> {
    try {
      if (!interaction.isStringSelectMenu()) return

      // カスタムIDをチェック
      if (interaction.customId !== 'character-thread-select') {
        return
      }

      // 選択されたキャラクターID
      const selectedCharacterId = interaction.values[0]

      this.logger.log(`Character thread selection: ${selectedCharacterId}`)

      // Orchestratorを呼び出し
      await this.orchestrator.handleSelection(interaction, selectedCharacterId)
    } catch (error) {
      this.logger.error('Error handling character thread select menu:', error)

      // エラー時のフォールバック
      try {
        await interaction.followUp({
          content: '⚠️ キャラクタースレッド選択の処理中にエラーが発生しました。もう一度お試しください。',
          ephemeral: true
        })
      } catch (replyError) {
        this.logger.error(
          'Failed to send error reply:',
          replyError instanceof Error ? replyError.message : String(replyError)
        )
      }
    }
  }
}
