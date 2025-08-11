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
  ComponentType,
  EmbedField
} from 'discord.js'
import { v4 as uuidv4 } from 'uuid'
import { Character } from '../../../../domains/character/models/character.model'
import { CharacterInputDto } from '../../../../domains/character/dto/create-character.dto'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { ErrorHandler } from '../../../../utils/error-handler'

/**
 * Embed分割タイプ
 */
export type EmbedSectionType = 'status' | 'skill' | 'parameter' | 'basic' | 'item'

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

      // スキルEmbed
      const skillEmbed = this.createSkillEmbed(character)
      embeds.push(skillEmbed)

      // アイテムEmbed
      const itemEmbed = this.createItemEmbed(character)
      embeds.push(itemEmbed)

      // 編集用コンポーネントを作成
      const components = this.createEditComponents(character.characterId)

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
   * ステータスEmbed (parameter) を作成
   */
  private createStatusEmbed(character: Character): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${character.characterName} - ステータス`)
      .setColor('#e74c3c')
      .setTimestamp()

    if (!character.parameter || Object.keys(character.parameter).length === 0) {
      embed.setDescription('ステータス情報がありません。\n編集ボタンから追加してください。')
      return embed
    }

    // parameterフィールドを処理
    const fields = this.processCharacterData(character.parameter, 'ステータス')

    if (fields.length > 0) {
      // Discord Embedの25フィールド制限を考慮
      embed.addFields(...fields.slice(0, 24))

      if (fields.length > 24) {
        embed.setFooter({ text: `${fields.length - 24}個のフィールドが省略されています` })
      }
    } else {
      embed.setDescription('表示可能なステータス情報がありません。')
    }

    return embed
  }

  /**
   * スキルEmbedを作成
   */
  private createSkillEmbed(character: Character): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${character.characterName} - スキル`)
      .setColor('#9b59b6')
      .setTimestamp()

    if (!character.skill || Object.keys(character.skill).length === 0) {
      embed.setDescription('スキル情報がありません。\n編集ボタンから追加してください。')
      return embed
    }

    const fields = this.processCharacterData(character.skill, 'スキル')

    if (fields.length > 0) {
      embed.addFields(...fields.slice(0, 24))

      if (fields.length > 24) {
        embed.setFooter({ text: `${fields.length - 24}個のスキルが省略されています` })
      }
    } else {
      embed.setDescription('表示可能なスキル情報がありません。')
    }

    return embed
  }

  /**
   * アイテムEmbedを作成
   */
  private createItemEmbed(character: Character): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🎒 ${character.characterName} - アイテム`)
      .setColor('#f39c12')
      .setTimestamp()

    if (!character.item || Object.keys(character.item).length === 0) {
      embed.setDescription('アイテム情報がありません。\n編集ボタンから追加してください。')
      return embed
    }

    const fields = this.processCharacterData(character.item, 'アイテム')

    if (fields.length > 0) {
      embed.addFields(...fields.slice(0, 24))

      if (fields.length > 24) {
        embed.setFooter({ text: `${fields.length - 24}個のアイテムが省略されています` })
      }
    } else {
      embed.setDescription('表示可能なアイテム情報がありません。')
    }

    return embed
  }

  /**
   * キャラクターデータを処理してフィールド配列を作成
   */
  private processCharacterData(data: Record<string, any>, dataType: string): EmbedField[] {
    const fields: EmbedField[] = []

    for (const [key, value] of Object.entries(data)) {
      if (!value || value === null || value === undefined) continue

      let fieldValue: string
      let fieldName: string = key

      // 値の型に応じて処理
      if (typeof value === 'object' && value !== null) {
        if ('name' in value && 'value' in value) {
          fieldName = value.name || key
          fieldValue = String(value.value || '')
        } else if ('description' in value || 'desc' in value) {
          fieldValue = String(value.description || value.desc || '')
        } else {
          // オブジェクトをJSON文字列として表示
          fieldValue = JSON.stringify(value, null, 2)
        }
      } else {
        fieldValue = String(value)
      }

      // 空の値をスキップ
      if (!fieldValue || fieldValue.trim() === '' || fieldValue === 'undefined') continue

      // Discord Embed field length limits
      if (fieldName.length > 256) fieldName = fieldName.substring(0, 253) + '...'
      if (fieldValue.length > 1024) fieldValue = fieldValue.substring(0, 1021) + '...'

      fields.push({
        name: fieldName,
        value: fieldValue,
        inline: true
      })
    }

    return fields
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
      case 'parameter':
        data = character.parameter
        sectionName = 'ステータス'
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
      let displayName = key
      let displayValue = String(value)

      // オブジェクトの場合は名前を優先
      if (typeof value === 'object' && value !== null && 'name' in value) {
        displayName = value.name || key
      }

      // 表示用に短縮
      if (displayName.length > 100) displayName = displayName.substring(0, 97) + '...'
      if (displayValue.length > 100) displayValue = displayValue.substring(0, 97) + '...'

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
  async sendSectionedEmbeds(channel: TextChannel, character: Character): Promise<void> {
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
        characterId: characterData.characterId || uuidv4(),
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

      // キャラクター作成イベントを発行
      await this.typedEventService.emit('character.creation.requested', {
        createData,
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
