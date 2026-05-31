import { Injectable, Logger } from '@nestjs/common'
import {
  AnySelectMenuInteraction,
  CacheType,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import { CharacterThreadOrchestrator } from '../../features/characterThread/services'
import { TypedEventService } from 'src/core/events/typed-event.service'
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
      console.log('test root')
      // カスタムIDをチェック（新しい形式にも対応）
      const customId = interaction.customId
      const isLegacySelect = customId === 'character-thread-select'
      const isThreadSelect = customId === 'character-thread-select-with-thread'
      const isCurrentSelect = customId === 'character-thread-select-current'
      const isCreateSelect = customId === 'character-thread-create-select'
      const isFlexibleDiceSelect = customId.startsWith('flexible-dice-param*')

      if (!isLegacySelect && !isThreadSelect && !isCurrentSelect && !isCreateSelect && !isFlexibleDiceSelect) {
        return
      }

      // 選択されたキャラクターID
      const selectedCharacterId = interaction.values[0]

      this.logger.log(`Character selection: ${selectedCharacterId}, mode: ${customId}`)

      if (isFlexibleDiceSelect) {
        // 柔軟ダイス計算のパラメータ選択処理
        await this.handleFlexibleDiceParameterSelection(interaction, selectedCharacterId)
      } else if (isLegacySelect) {
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
   * 柔軟ダイス計算のパラメータ選択処理
   */
  private async handleFlexibleDiceParameterSelection(
    interaction: StringSelectMenuInteraction,
    selectedValue: string
  ): Promise<void> {
    try {
      // CustomIdからcharacterIdを抽出
      const characterId = this.extractCharacterIdFromCustomId(interaction.customId)

      this.logger.log(`Flexible dice parameter selection: ${selectedValue}, characterId: ${characterId}`)

      // 選択値をパース: "status:key:value" or "custom:formula:0"
      const [section, key, value] = selectedValue.split(':')

      if (section === 'custom') {
        // カスタム計算式の場合は通常のカスタムモーダルを表示
        await this.showCustomDiceModal(interaction, characterId)
      } else {
        // パラメータが選択された場合は専用モーダルを表示
        await this.showParameterDiceModal(interaction, characterId, section, key, value)
      }
    } catch (error) {
      this.logger.error('Failed to handle flexible dice parameter selection', error)
      await interaction.reply({
        content: '❌ パラメータ選択の処理中にエラーが発生しました。',
        ephemeral: true
      })
    }
  }

  /**
   * パラメータベースのダイス計算モーダルを表示
   */
  private async showParameterDiceModal(
    interaction: StringSelectMenuInteraction,
    characterId: string | null,
    section: string,
    key: string,
    value: string
  ): Promise<void> {
    const modalCustomId = characterId ? `param-dice-modal*${characterId}` : 'param-dice-modal'

    const modal = new ModalBuilder()
      .setCustomId(modalCustomId)
      .setTitle(`${this.getSectionEmoji(section)} 柔軟ダイス計算`)

    // プリセット計算式入力（編集可能）
    const formulaInput = new TextInputBuilder()
      .setCustomId('dice-formula')
      .setLabel('計算式（編集可能）')
      .setStyle(TextInputStyle.Short)
      .setValue(`${key}`)
      .setPlaceholder(`例: ${key}*3+4, ${key}×2-1`)
      .setRequired(true)
      .setMaxLength(50)

    // 乗数入力フィールド
    const multiplierInput = new TextInputBuilder()
      .setCustomId('multiplier')
      .setLabel('乗数（任意）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 2, 3, 0.5（空白の場合は1）')
      .setRequired(false)
      .setMaxLength(10)

    // 修正値入力フィールド
    const modifierInput = new TextInputBuilder()
      .setCustomId('modifier')
      .setLabel('修正値（任意）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: +5, -2（空白の場合は0）')
      .setRequired(false)
      .setMaxLength(10)

    // コメント入力フィールド
    const commentInput = new TextInputBuilder()
      .setCustomId('dice-comment')
      .setLabel('コメント（任意）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`例: ${key}を使った判定`)
      .setRequired(false)
      .setMaxLength(50)

    // アクションロウを作成
    const formulaRow = new ActionRowBuilder<TextInputBuilder>().addComponents(formulaInput)
    const multiplierRow = new ActionRowBuilder<TextInputBuilder>().addComponents(multiplierInput)
    const modifierRow = new ActionRowBuilder<TextInputBuilder>().addComponents(modifierInput)
    const commentRow = new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)

    // モーダルにアクションロウを追加
    modal.addComponents(formulaRow, multiplierRow, modifierRow, commentRow)

    // モーダルを表示
    await interaction.showModal(modal)
  }

  /**
   * カスタム計算式モーダルを表示
   */
  private async showCustomDiceModal(
    interaction: StringSelectMenuInteraction,
    characterId: string | null
  ): Promise<void> {
    const modalCustomId = characterId ? `custom-dice-modal*${characterId}` : 'custom-dice-modal'

    const modal = new ModalBuilder().setCustomId(modalCustomId).setTitle('🔧 カスタム計算式')

    // 計算式入力フィールド
    const formulaInput = new TextInputBuilder()
      .setCustomId('dice-command')
      .setLabel('ダイス/計算式')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 2d6+3, status*3+4, skill×2-1')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(50)

    // 乗数入力フィールド
    const multiplierInput = new TextInputBuilder()
      .setCustomId('multiplier')
      .setLabel('乗数（任意）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 2, 3, 0.5（空白の場合は1）')
      .setRequired(false)
      .setMaxLength(10)

    // 修正値入力フィールド
    const modifierInput = new TextInputBuilder()
      .setCustomId('modifier')
      .setLabel('修正値（任意）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: +5, -2（空白の場合は0）')
      .setRequired(false)
      .setMaxLength(10)

    // コメント入力フィールド
    const commentInput = new TextInputBuilder()
      .setCustomId('dice-comment')
      .setLabel('コメント（任意）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 攻撃力判定、跳躍距離計算など')
      .setRequired(false)
      .setMaxLength(50)

    // アクションロウを作成
    const formulaRow = new ActionRowBuilder<TextInputBuilder>().addComponents(formulaInput)
    const multiplierRow = new ActionRowBuilder<TextInputBuilder>().addComponents(multiplierInput)
    const modifierRow = new ActionRowBuilder<TextInputBuilder>().addComponents(modifierInput)
    const commentRow = new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)

    // モーダルにアクションロウを追加
    modal.addComponents(formulaRow, multiplierRow, modifierRow, commentRow)

    // モーダルを表示
    await interaction.showModal(modal)
  }

  /**
   * CustomIdからcharacterIdを抽出
   */
  private extractCharacterIdFromCustomId(customId: string): string | null {
    try {
      const parts = customId.split('*')
      if (parts.length >= 2 && parts[0] === 'flexible-dice-param') {
        return parts[1]
      }
      return null
    } catch (error) {
      this.logger.warn(`CustomIdの解析に失敗: ${customId}`, error)
      return null
    }
  }

  /**
   * セクション名に対応する絵文字を取得
   */
  private getSectionEmoji(section: string): string {
    const emojiMap: { [key: string]: string } = {
      status: '📊',
      skill: '⚔️',
      parameter: '⚙️'
    }
    return emojiMap[section] || '🎲'
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
      await interaction.deferUpdate()

      // キャラクター情報を取得
      const character = await this.characterService.findOne(selectedCharacterId)

      if (!character) {
        await interaction.editReply({
          content: `❌ キャラクターID「${selectedCharacterId}」が見つかりませんでした。`,
          components: []
        })
        return
      }

      // 権限チェック
      if (character.discordUserId !== interaction.user.id) {
        await interaction.editReply({
          content: '❌ 他のユーザーのキャラクターは使用できません。',
          components: []
        })
        return
      }

      // 作成中メッセージを表示
      await interaction.editReply({
        content: `🔄 ${character.characterName}のスレッドを作成中...`,
        components: []
      })

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

      // await interaction.editReply({
      //   content: `✅ ${character.characterName}のスレッドを作成しました。高度なキャラクター表示機能付きです！`
      // })
    } catch (error) {
      this.logger.error(`Failed to create thread for character: ${selectedCharacterId}`, error)

      try {
        await interaction.editReply({
          content: '❌ スレッド作成中にエラーが発生しました。',
          components: []
        })
      } catch (editError) {
        this.logger.error('Failed to send error response', editError)
      }
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
