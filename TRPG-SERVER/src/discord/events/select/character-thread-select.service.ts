import { Injectable, Logger } from '@nestjs/common'
import { AnySelectMenuInteraction, CacheType, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import { CharacterThreadOrchestrator } from '../../features/characterThread/services'
import { TypedEventService } from 'src/shared/application/typed-event.service'
import { CharacterService } from 'src/domains/character/character.service'

@Injectable()
export class CharacterThreadSelectService implements discordSelectMenuType {
  private readonly logger = new Logger(CharacterThreadSelectService.name)

  // メニューの基本設定（実際のインスタンスは動的に生成される）
  public data = new StringSelectMenuBuilder()
    .setCustomId('character-thread-select')
    .setPlaceholder('キャラクターを選択')

  constructor(
    private readonly orchestrator: CharacterThreadOrchestrator,
    private readonly typedEventService: TypedEventService,
    private readonly characterService: CharacterService
  ) {}

  /**
   * キャラクタースレッド選択メニューが操作されたときの処理
   * 新しいカスタムID形式にも対応
   */
  async execute(interaction: AnySelectMenuInteraction<CacheType>): Promise<void> {
    try {
      if (!interaction.isStringSelectMenu()) return

      // カスタムIDをチェック（新しい形式にも対応）
      const customId = interaction.customId
      const isLegacySelect = customId === 'character-thread-select'
      const isThreadSelect = customId === 'character-thread-select-with-thread'
      const isCurrentSelect = customId === 'character-thread-select-current'
      const isCreateSelect = customId === 'character-thread-create-select'

      if (!isLegacySelect && !isThreadSelect && !isCurrentSelect && !isCreateSelect) {
        return
      }

      // 選択されたキャラクターID
      const selectedCharacterId = interaction.values[0]

      this.logger.log(`Character selection: ${selectedCharacterId}, mode: ${customId}`)

      if (isLegacySelect) {
        // 既存の処理（後方互換性）
        await this.orchestrator.handleSelection(interaction, selectedCharacterId)
      } else if (isCreateSelect) {
        // 新しいスレッド作成専用処理
        await this.handleThreadCreationSelection(interaction, selectedCharacterId)
      } else {
        // 新しいEnhanced処理
        await this.handleEnhancedSelection(interaction, selectedCharacterId, isThreadSelect)
      }
    } catch (error) {
      this.logger.error('Error handling character thread select menu:', error)

      // エラー時のフォールバック
      try {
        await interaction.followUp({
          content: '⚠️ キャラクター選択の処理中にエラーが発生しました。もう一度お試しください。',
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

  /**
   * スレッド作成専用選択処理
   */
  private async handleThreadCreationSelection(
    interaction: StringSelectMenuInteraction,
    selectedCharacterId: string
  ): Promise<void> {
    this.logger.log(`Thread creation selection: ${selectedCharacterId}`)

    try {
      await interaction.update({
        content: `🔄 選択されたキャラクターでスレッドを作成中...`,
        components: []
      })

      // キャラクター情報を取得
      const character = await this.characterService.findOne(selectedCharacterId)

      if (!character) {
        await interaction.editReply({
          content: `❌ キャラクターID「${selectedCharacterId}」が見つかりませんでした。`
        })
        return
      }

      // 権限チェック
      if (character.discordUserId !== interaction.user.id) {
        await interaction.editReply({
          content: '❌ 他のユーザーのキャラクターは使用できません。'
        })
        return
      }

      console.log('character', character)

      // TypedEventServiceを使用してスレッド作成イベントを発行
      await this.typedEventService.emit('discord.thread.create.requested', {
        character,
        channelId: interaction.channel!.id,
        guildId: interaction.guild!.id,
        creatorId: interaction.user.id,
        displayType: 'enhanced',
        source: 'character-thread-select',
        timestamp: new Date()
      })

      await interaction.editReply({
        content: `✅ ${character.characterName}のスレッドを作成しました。高度なキャラクター表示機能付きです！`
      })
    } catch (error) {
      this.logger.error(`Failed to create thread for character: ${selectedCharacterId}`, error)
      await interaction.editReply({
        content: '❌ スレッド作成中にエラーが発生しました。'
      })
    }
  }

  /**
   * 新しい拡張選択処理
   */
  private async handleEnhancedSelection(
    interaction: StringSelectMenuInteraction,
    selectedCharacterId: string,
    createThread: boolean
  ): Promise<void> {
    this.logger.log(`Enhanced character selection: ${selectedCharacterId}, createThread: ${createThread}`)

    // この処理は実際には新しいコマンドサービスで行った処理と同様
    // TypedEventService経由でイベントを発行

    // ここでは簡易的に既存のOrchestratorを使用してレガシー処理を行う
    // 実際の実装では新しいイベント駆動処理を行う

    if (createThread) {
      await this.orchestrator.handleSelection(interaction, selectedCharacterId)
    } else {
      // 現在のチャンネルに表示する場合の処理
      await interaction.update({
        content: `🎭 キャラクター「${selectedCharacterId}」を現在のチャンネルに表示します...`,
        components: []
      })
    }
  }
}
