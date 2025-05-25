import { Injectable } from '@nestjs/common'
import { AnySelectMenuInteraction, CacheType, StringSelectMenuBuilder } from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import { DiceRollPaginationService } from 'src/discord/components/pagination/dice-roll-pagination.service'
import { CharacterService } from 'src/domains/character/character.service'

@Injectable()
export class DiceCharacterSelectService implements discordSelectMenuType {
  // メニューの基本設定（実際のインスタンスは動的に生成される）
  public data = new StringSelectMenuBuilder().setCustomId('dice-char-select*').setPlaceholder('キャラクターを選択')

  constructor(
    private readonly paginationService: DiceRollPaginationService,
    private readonly characterService: CharacterService
  ) {}

  /**
   * キャラクター選択メニューが操作されたときの処理
   */
  async execute(interaction: AnySelectMenuInteraction<CacheType>): Promise<void> {
    try {
      if (!interaction.isStringSelectMenu()) return

      // インタラクションの処理中を表示
      await interaction.deferUpdate()

      // カスタムIDからメッセージIDとチャンネルIDを抽出
      const customId = interaction.customId
      const [_, messageId, channelId] = customId.split('*')

      if (!messageId || !channelId) {
        console.error('Invalid customId format:', customId)
        await interaction.followUp({
          content: '⚠️ 選択メニューの処理中にエラーが発生しました。',
          ephemeral: true
        })
        return
      }

      // 選択されたキャラクターID
      const selectedCharacterId = interaction.values[0]

      // キャラクター名を取得（ログ用およびフィードバック用）
      let characterName = '全てのキャラクター'
      if (selectedCharacterId !== 'all') {
        try {
          const character = await this.characterService.findOne(selectedCharacterId)
          if (character && character.characterName) {
            characterName = character.characterName
          }
        } catch (error) {
          console.error(`キャラクター情報取得エラー (ID: ${selectedCharacterId}):`, error)
        }
      }

      console.log(`キャラクター選択: ${characterName} (ID: ${selectedCharacterId})`)

      // キャラクターの選択に基づいてページを更新
      const newState = await this.paginationService.updateCharacter(channelId, messageId, selectedCharacterId)

      if (!newState || newState.pages.length === 0) {
        console.error('Failed to update character selection')
        await interaction.followUp({
          content: `⚠️ ${characterName}のダイスロール履歴が見つかりませんでした。`,
          ephemeral: true
        })
        return
      }

      // ページネーションコントロールを更新
      const controls = await this.paginationService.createPaginationControls(messageId, channelId, newState.totalPages)

      // メッセージを更新
      await interaction.editReply({
        embeds: [newState.pages[0]],
        components: controls
      })
    } catch (error) {
      console.error('Error handling character select menu:', error)

      // エラー時のフォールバック
      try {
        await interaction.followUp({
          content: '⚠️ キャラクター選択の処理中にエラーが発生しました。もう一度お試しください。',
          ephemeral: true
        })
      } catch (replyError) {
        console.error('エラー応答の送信に失敗:', replyError)
      }
    }
  }
}
