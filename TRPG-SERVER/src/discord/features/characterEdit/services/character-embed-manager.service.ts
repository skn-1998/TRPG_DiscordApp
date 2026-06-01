/**
 * Character Embed Manager Service
 *
 * キャラクター情報を分割Embedで管理するサービス
 * Status、Skill、Parameter別に分けて表示・編集機能を提供
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ThreadChannel,
  EmbedField
} from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { CharacterInputDto } from '../../../../domains/character/dto/create-character.dto'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { ErrorHandler } from '../../../../utils/error-handler'
import {
  generateShortCharacterId,
  buildAttributeFields,
  buildFieldOptionDisplay,
  extractDiceRollValue
} from '../utils/character-embed.util'

/**
 * Embed分割タイプ
 */
export type EmbedSectionType = 'status' | 'skill' | 'parameter' | 'basic' | 'item' | 'back'

/**
 * キャラクター編集アクション
 */
export interface CharacterEditAction {
  type: 'add' | 'edit' | 'delete'
  section: EmbedSectionType
  field?: string
}

@Injectable()
export class CharacterEmbedManagerService {
  private readonly logger = new Logger(CharacterEmbedManagerService.name)

  constructor(private readonly typedEventService: TypedEventService) {}

  /**
   * キャラクター情報を分割Embedで表示
   */
  async createSectionedEmbeds(character: Character): Promise<{
    embeds: EmbedBuilder[]
    components: ActionRowBuilder<any>[]
  }> {
    try {
      const embeds: EmbedBuilder[] = []

      // 基本情報Embed
      const basicEmbed = this.createBasicEmbed(character)
      embeds.push(basicEmbed)

      // ステータスEmbed (parameter)
      const statusEmbed = this.createStatusEmbed(character)
      embeds.push(statusEmbed)

      // パラメータEmbed (parameter の詳細表示)
      const parameterEmbed = this.createParameterEmbed(character)
      embeds.push(parameterEmbed)

      // スキルEmbed
      const skillEmbed = this.createSkillEmbed(character)
      embeds.push(skillEmbed)

      // アイテムEmbed
      const itemEmbed = this.createItemEmbed(character)
      embeds.push(itemEmbed)

      // 編集用コンポーネントを作成
      const components = this.createEditComponents(character.characterId)

      // ダイスロールボタンを追加（skill、status、parameterの個別表示のみ）
      const diceRollButtons = this.createCharacterDiceRollButtons(character)
      components.push(...diceRollButtons)

      // 基本ダイスロールボタンは重複を避けるためコメントアウト
      // const basicDiceButtons = this.createBasicDiceButtons(character)
      // components.push(basicDiceButtons)

      return { embeds, components }
    } catch (error) {
      ErrorHandler.handleServiceError(error, { characterId: character.characterId }, 'CharacterEmbedManagerService')
      throw error
    }
  }

  /**
   * 基本情報Embedを作成
   */
  private createBasicEmbed(character: Character): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🏷️ ${character.characterName} - 基本情報`)
      .setColor('#3498db')
      .setTimestamp()

    // 基本フィールド
    const fields: EmbedField[] = []

    if (character.gameSystemId) {
      fields.push({
        name: '🎲 ゲームシステム',
        value: character.gameSystemId,
        inline: true
      })
    }

    fields.push(
      {
        name: '🆔 キャラクターID',
        value: character.characterId,
        inline: true
      },
      {
        name: '👤 プレイヤー',
        value: `<@${character.discordUserId}>`,
        inline: true
      }
    )

    embed.addFields(...fields)
    return embed
  }

  /**
   * ステータスEmbed を作成
   */
  private createStatusEmbed(character: Character): EmbedBuilder {
    return this.createSectionEmbed('📊', 'ステータス', '#e74c3c', character.characterName, character.status)
  }

  /**
   * パラメータEmbed を作成
   */
  private createParameterEmbed(character: Character): EmbedBuilder {
    return this.createSectionEmbed('⚙️', 'パラメータ', '#34495e', character.characterName, character.parameter)
  }

  /**
   * スキルEmbedを作成
   */
  private createSkillEmbed(character: Character): EmbedBuilder {
    return this.createSectionEmbed('⚔️', 'スキル', '#9b59b6', character.characterName, character.skill)
  }

  /**
   * アイテムEmbedを作成
   */
  private createItemEmbed(character: Character): EmbedBuilder {
    return this.createSectionEmbed('🎒', 'アイテム', '#f39c12', character.characterName, character.item)
  }

  /**
   * セクション別Embedを作成する共通処理
   *
   * status/parameter/skill/item の共通の表示ロジックを集約。
   * フィールドの整形は純粋関数 buildAttributeFields に委譲する。
   */
  private createSectionEmbed(
    emoji: string,
    sectionName: string,
    color: `#${string}`,
    characterName: string,
    data: Record<string, any> | undefined
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${characterName} - ${sectionName}`)
      .setColor(color)
      .setTimestamp()

    if (!data || Object.keys(data).length === 0) {
      embed.setDescription(`${sectionName}情報がありません。\n編集ボタンから追加してください。`)
      return embed
    }

    const fields = buildAttributeFields(data)

    if (fields.length > 0) {
      // Discord Embedの25フィールド制限を考慮
      embed.addFields(...fields.slice(0, 24))

      if (fields.length > 24) {
        embed.setFooter({ text: `${fields.length - 24}個の${sectionName}が省略されています` })
      }
    } else {
      embed.setDescription(`表示可能な${sectionName}情報がありません。`)
    }

    return embed
  }

  /**
   * 編集用コンポーネントを作成
   */
  private createEditComponents(characterId: string): ActionRowBuilder<any>[] {
    const components: ActionRowBuilder<any>[] = []

    // セクション選択メニュー
    const sectionSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`character-edit-section-${characterId}`)
      .setPlaceholder('編集するセクションを選択')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('📊 ステータス')
          .setValue('status')
          .setDescription('基本ステータスを編集'),
        new StringSelectMenuOptionBuilder()
          .setLabel('⚙️ パラメータ')
          .setValue('parameter')
          .setDescription('能力値やパラメータを編集'),
        new StringSelectMenuOptionBuilder().setLabel('⚔️ スキル').setValue('skill').setDescription('技能や特技を編集'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🎒 アイテム')
          .setValue('item')
          .setDescription('装備品やアイテムを編集')
      )

    const sectionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sectionSelectMenu)

    // 操作ボタン
    const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`character-refresh-${characterId}`)
        .setLabel('🔄 更新')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`character-compact-view-${characterId}`)
        .setLabel('📋 簡易表示')
        .setStyle(ButtonStyle.Secondary)
    )

    components.push(sectionRow, actionButtons)
    return components
  }

  /**
   * キャラクターのskill、status、parameterに基づいてダイスロールボタンを生成
   */
  private createCharacterDiceRollButtons(character: Character): ActionRowBuilder<ButtonBuilder>[] {
    const buttons: ButtonBuilder[] = []
    const actionRows: ActionRowBuilder<ButtonBuilder>[] = []

    let buttonCount = 0
    const maxButtonsPerRow = 5
    const maxTotalButtons = 20 // Discord制限に配慮

    // skillセクションのボタンを生成
    if (character.skill && Object.keys(character.skill).length > 0) {
      buttonCount = this.addDiceRollButtonsFromData(
        character.skill,
        'スキル',
        '🎯',
        character.characterId,
        buttons,
        buttonCount,
        maxTotalButtons
      )
    }

    // statusセクションのボタンを生成
    if (character.status && Object.keys(character.status).length > 0) {
      buttonCount = this.addDiceRollButtonsFromData(
        character.status,
        'ステータス',
        '📊',
        character.characterId,
        buttons,
        buttonCount,
        maxTotalButtons
      )
    }

    // parameterセクションのボタンを生成
    if (character.parameter && Object.keys(character.parameter).length > 0) {
      buttonCount = this.addDiceRollButtonsFromData(
        character.parameter,
        'パラメータ',
        '⚙️',
        character.characterId,
        buttons,
        buttonCount,
        maxTotalButtons
      )
    }

    // // ボタンを行に分割
    // for (let i = 0; i < buttons.length; i += maxButtonsPerRow) {
    //   const rowButtons = buttons.slice(i, i + maxButtonsPerRow)
    //   if (rowButtons.length > 0) {
    //     const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rowButtons)
    //     actionRows.push(row)
    //   }
    // }

    return actionRows
  }

  /**
   * 指定されたデータからダイスロールボタンを追加
   */
  private addDiceRollButtonsFromData(
    data: Record<string, any>,
    sectionName: string,
    emoji: string,
    characterId: string,
    buttons: ButtonBuilder[],
    buttonCount: number,
    maxTotalButtons: number
  ): number {
    for (const [key, value] of Object.entries(data)) {
      if (buttonCount >= maxTotalButtons) break

      // データの形式を判定（純粋関数へ委譲）
      const { name, rollValue } = extractDiceRollValue(key, value)

      // ロール値が0以下の場合はスキップ
      if (rollValue <= 0) continue

      // ダイスロールボタンを作成
      // customId形式: roll*_{name}-{rollValue}*{characterId}
      const customId = `roll*_${name}-${rollValue}*${characterId}`

      const button = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(`${name}(${rollValue})`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emoji)

      buttons.push(button)
      buttonCount++
    }

    return buttonCount
  }

  /**
   * 基本ダイスロールボタンを生成
   */
  private createBasicDiceButtons(character: Character): ActionRowBuilder<ButtonBuilder> {
    const diceButtons = [
      new ButtonBuilder()
        .setCustomId(`roll*1d100*${character.characterId}`)
        .setLabel('1D100')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🎲'),

      new ButtonBuilder()
        .setCustomId(`roll*1d6*${character.characterId}`)
        .setLabel('1D6')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎲'),

      new ButtonBuilder()
        .setCustomId(`roll*2d6*${character.characterId}`)
        .setLabel('2D6')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎲'),

      new ButtonBuilder()
        .setCustomId(`roll*custom*${character.characterId}`)
        .setLabel('カスタム')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚙️')
    ]

    return new ActionRowBuilder<ButtonBuilder>().addComponents(diceButtons)
  }

  /**
   * 特定セクションのフィールド選択メニューを作成
   */
  createFieldSelectMenu(
    character: Character,
    sectionType: EmbedSectionType,
    characterId: string
  ): StringSelectMenuBuilder | null {
    let data: Record<string, any> | undefined
    let sectionName: string

    switch (sectionType) {
      case 'status':
        data = character.status
        sectionName = 'ステータス'
        break
      case 'parameter':
        data = character.parameter
        sectionName = 'パラメータ'
        break
      case 'skill':
        data = character.skill
        sectionName = 'スキル'
        break
      case 'item':
        data = character.item
        sectionName = 'アイテム'
        break
      default:
        return null
    }

    if (!data || Object.keys(data).length === 0) {
      // データがない場合は追加専用メニュー
      return new StringSelectMenuBuilder()
        .setCustomId(`character-field-add-${sectionType}-${characterId}`)
        .setPlaceholder(`${sectionName}を追加`)
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`➕ 新しい${sectionName}を追加`)
            .setValue('add_new')
            .setDescription(`新しい${sectionName}項目を追加します`)
        )
    }

    // 既存フィールドの編集メニュー
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`character-field-edit-${sectionType}-${characterId}`)
      .setPlaceholder(`編集する${sectionName}を選択`)

    const options: StringSelectMenuOptionBuilder[] = []

    // 新規追加オプション
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`➕ 新しい${sectionName}を追加`)
        .setValue('add_new')
        .setDescription(`新しい${sectionName}項目を追加します`)
    )

    // 既存フィールドのオプション
    const fieldEntries = Object.entries(data).slice(0, 23) // Discord制限考慮

    for (const [key, value] of fieldEntries) {
      // AttributeValue / レガシー形式の表示整形を純粋関数へ委譲（短縮処理含む）
      const { displayName, displayValue } = buildFieldOptionDisplay(key, value)

      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`✏️ ${displayName}`)
          .setValue(key)
          .setDescription(`${displayValue}`)
      )
    }

    selectMenu.addOptions(...options)
    return selectMenu
  }

  /**
   * チャンネルに分割Embedを送信
   */
  async sendSectionedEmbeds(channel: TextChannel | ThreadChannel, character: Character): Promise<void> {
    try {
      const { embeds, components } = await this.createSectionedEmbeds(character)

      // 複数のEmbedを一度に送信（Discordの10 embed制限内）
      await channel.send({
        embeds,
        components
      })

      this.logger.log(`Sectioned embeds sent for character: ${character.characterId}`)
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        { channelId: channel.id, characterId: character.characterId },
        'CharacterEmbedManagerService'
      )
      throw error
    }
  }

  /**
   * 新規キャラクター作成
   */
  async createCharacter(
    characterData: CharacterInputDto,
    channelId: string,
    userId: string
  ): Promise<Character | null> {
    try {
      this.logger.log(`Creating new character: ${characterData.characterName} for user: ${userId}`)

      // CharacterInputDtoからCreateCharacterDtoに変換
      const createData = {
        characterId: characterData.characterId || generateShortCharacterId(),
        characterName: characterData.characterName || '',
        gameSystemId: characterData.gameSystemId || '',
        discordUserId: userId,
        discordChannelId: channelId,
        status: characterData.status,
        parameter: characterData.parameter,
        skill: characterData.skill,
        item: characterData.item,
        description: characterData.description
      }

      // キャラクター作成イベントを発行 (Event Bridge対応)
      await this.typedEventService.emit('character.creation.requested', {
        createData,
        requester: {
          featureId: 'characterEdit',
          context: {
            channelId: channelId,
            sectionType: 'basic',
            triggeredBy: 'modal' // embed manager経由はモーダル入力
          }
        },
        userId,
        source: 'character-embed-manager',
        timestamp: new Date()
      })

      // 作成完了を待機
      const result = await Promise.race([
        this.typedEventService.waitForEvent('character.creation.completed', 10000),
        this.typedEventService.waitForEvent('character.creation.failed', 10000)
      ])

      if ('character' in result) {
        this.logger.log(`Character created successfully: ${result.character.characterId}`)
        return result.character
      } else {
        this.logger.error(`Character creation failed:`, result)
        return null
      }
    } catch (error) {
      this.logger.error('Failed to create character', error)
      return null
    }
  }

  /**
   * 新規キャラクター作成用のEmbedを作成
   */
  createNewCharacterEmbed(
    channelId: string,
    userId: string
  ): {
    embeds: EmbedBuilder[]
    components: ActionRowBuilder<any>[]
  } {
    const embed = new EmbedBuilder()
      .setTitle('🆕 新しいキャラクターを作成')
      .setDescription('新しいキャラクターを作成します。\n下のボタンから基本情報を入力してください。')
      .setColor('#2ecc71')
      .setTimestamp()
      .addFields({
        name: '📝 作成手順',
        value:
          '1️⃣ 「基本情報入力」ボタンをクリック\n2️⃣ キャラクター名とゲームシステムを入力\n3️⃣ 作成後に詳細情報を編集',
        inline: false
      })

    // 作成ボタン
    const createButton = new ButtonBuilder()
      .setCustomId(`character-create-basic-${channelId}-${userId}`)
      .setLabel('📝 基本情報入力')
      .setStyle(ButtonStyle.Primary)

    const cancelButton = new ButtonBuilder()
      .setCustomId(`character-create-cancel-${channelId}-${userId}`)
      .setLabel('❌ キャンセル')
      .setStyle(ButtonStyle.Secondary)

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(createButton, cancelButton)

    return {
      embeds: [embed],
      components: [buttonRow]
    }
  }

  /**
   * キャラクター作成完了メッセージ
   */
  createCharacterCreatedEmbed(character: Character): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('✅ キャラクター作成完了')
      .setDescription(
        `**${character.characterName}** が正常に作成されました！\n下記のキャラクター情報から詳細を編集できます。`
      )
      .setColor('#27ae60')
      .setTimestamp()
      .addFields(
        {
          name: '🎲 ゲームシステム',
          value: character.gameSystemId || '未設定',
          inline: true
        },
        {
          name: '🆔 キャラクターID',
          value: character.characterId,
          inline: true
        },
        {
          name: '👤 作成者',
          value: `<@${character.discordUserId}>`,
          inline: true
        }
      )
  }
}
