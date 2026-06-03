import { Injectable, Logger } from '@nestjs/common'
import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ColorResolvable,
  Colors
} from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'

/**
 * ダイスボタンUIサービス
 *
 * 責務：
 * - ダイスロール用UI要素の作成・管理
 * - ボタンインタラクションの初期処理
 * - モーダル・エンベッドの表示
 */
@Injectable()
export class DiceButtonUIService implements discordButtonType {
  private readonly logger = new Logger(DiceButtonUIService.name)

  constructor() {
    this.logger.debug('Dice button UI service initialized')
  }

  // ButtonBuilderのインスタンス（discordButtonTypeインターフェース要件）
  public data = new ButtonBuilder().setCustomId('roll-1d100').setLabel('1D100').setStyle(ButtonStyle.Danger)

  /**
   * ボタンインタラクションの初期処理
   */
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      const customId = interaction.customId

      // カスタムダイスロールの場合
      if (customId === 'roll*custom') {
        await this.handleCustomDiceRoll(interaction)
        return
      }

      // その他の処理は他のサービスに委譲
      await interaction.deferUpdate()

      this.logger.debug(`Button interaction processed: ${customId}`)
    } catch (error) {
      this.logger.error('Failed to execute button interaction', error)

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'ボタン処理中にエラーが発生しました。',
          ephemeral: true
        })
      }
    }
  }

  /**
   * カスタムダイスロールモーダルを表示
   */
  private async handleCustomDiceRoll(interaction: ButtonInteraction): Promise<void> {
    try {
      const modal = this.createCustomDiceModal()
      await interaction.showModal(modal)

      this.logger.debug('Custom dice modal shown')
    } catch (error) {
      this.logger.error('Failed to show custom dice modal', error)
      throw error
    }
  }

  /**
   * カスタムダイスモーダルを作成
   */
  createCustomDiceModal(): ModalBuilder {
    const modal = new ModalBuilder().setCustomId('custom-dice-modal').setTitle('カスタムダイスロール')

    const diceInput = new TextInputBuilder()
      .setCustomId('dice-expression')
      .setLabel('ダイス式を入力してください')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 1d100, 2d6+3, 3d10')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(50)

    const reasonInput = new TextInputBuilder()
      .setCustomId('roll-reason')
      .setLabel('ロール理由（オプション）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 技能判定, 攻撃ロール')
      .setRequired(false)
      .setMaxLength(100)

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(diceInput)
    const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)

    modal.addComponents(firstRow, secondRow)

    return modal
  }

  /**
   * ダイスロール用ボタンセットを作成
   */
  createDiceRollButtons(
    channelId: string,
    diceTypes: Array<{ label: string; dice: string; style?: ButtonStyle }>
  ): ActionRowBuilder<ButtonBuilder>[] {
    const buttons: ButtonBuilder[] = []

    diceTypes.forEach((diceType) => {
      const button = new ButtonBuilder()
        .setCustomId(`roll*${diceType.dice}*${channelId}`)
        .setLabel(diceType.label)
        .setStyle(diceType.style || ButtonStyle.Secondary)
        .setEmoji('🎲')

      buttons.push(button)
    })

    // ボタンを5個ずつ行に分割
    const rows: ActionRowBuilder<ButtonBuilder>[] = []
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5))
      rows.push(row)
    }

    return rows
  }

  /**
   * スキルロール用ボタンセットを作成
   */
  createSkillRollButtons(
    channelId: string,
    skills: Array<{ name: string; value: number; customId: string }>
  ): ActionRowBuilder<ButtonBuilder>[] {
    const buttons: ButtonBuilder[] = []

    skills.forEach((skill) => {
      const button = new ButtonBuilder()
        .setCustomId(`skill*${skill.customId}*${channelId}`)
        .setLabel(`${skill.name} (${skill.value})`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎯')

      buttons.push(button)
    })

    // ボタンを5個ずつ行に分割
    const rows: ActionRowBuilder<ButtonBuilder>[] = []
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5))
      rows.push(row)
    }

    return rows
  }

  /**
   * ダイスロール結果表示用エンベッドを作成
   */
  createDiceResultEmbed(
    characterName: string,
    diceExpression: string,
    result: number,
    details: string,
    reason?: string,
    color: ColorResolvable = Colors.Blue
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('🎲 ダイスロール結果')
      .setColor(color)
      .addFields(
        { name: 'キャラクター', value: characterName, inline: true },
        { name: 'ダイス', value: diceExpression, inline: true },
        { name: '結果', value: `**${result}**`, inline: true },
        { name: '詳細', value: details, inline: false }
      )
      .setTimestamp()

    if (reason) {
      embed.addFields({ name: '理由', value: reason, inline: false })
    }

    return embed
  }

  /**
   * エラー表示用エンベッドを作成
   */
  createErrorEmbed(message: string, details?: string): EmbedBuilder {
    const embed = new EmbedBuilder().setTitle('❌ エラー').setColor(Colors.Red).setDescription(message).setTimestamp()

    if (details) {
      embed.addFields({ name: '詳細', value: details, inline: false })
    }

    return embed
  }

  /**
   * ページネーション用ボタンを作成
   */
  createPaginationButtons(
    channelId: string,
    currentPage: number,
    totalPages: number,
    isFirst: boolean,
    isLast: boolean
  ): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>()

    // 最初のページボタン
    const firstButton = new ButtonBuilder()
      .setCustomId(`dice_page_first_${channelId}`)
      .setLabel('最初')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⏪')
      .setDisabled(isFirst)

    // 前のページボタン
    const prevButton = new ButtonBuilder()
      .setCustomId(`dice_page_prev_${channelId}`)
      .setLabel('前')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
      .setDisabled(isFirst)

    // ページ情報
    const pageButton = new ButtonBuilder()
      .setCustomId(`dice_page_info_${channelId}`)
      .setLabel(`${currentPage}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true)

    // 次のページボタン
    const nextButton = new ButtonBuilder()
      .setCustomId(`dice_page_next_${channelId}`)
      .setLabel('次')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('▶️')
      .setDisabled(isLast)

    // 最後のページボタン
    const lastButton = new ButtonBuilder()
      .setCustomId(`dice_page_last_${channelId}`)
      .setLabel('最後')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⏩')
      .setDisabled(isLast)

    row.addComponents(firstButton, prevButton, pageButton, nextButton, lastButton)

    return row // メインの行のみ返す（キャンセル行は必要に応じて別途作成）
  }

  /**
   * キャンセル用ボタン行を作成
   */
  createCancelButtonRow(channelId: string): ActionRowBuilder<ButtonBuilder> {
    const cancelButton = new ButtonBuilder()
      .setCustomId(`dice_page_cancel_${channelId}`)
      .setLabel('閉じる')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')

    return new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton)
  }
}
