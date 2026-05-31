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
  ComponentType,
  EmbedField
} from 'discord.js'
import { v4 as uuidv4 } from 'uuid'
import { randomBytes } from 'crypto'
import { Character } from '../../../../domains/character/models/character.model'
import { CharacterInputDto } from '../../../../domains/character/dto/create-character.dto'
import { AttributeValue, getDisplayNumber } from '../../../../core/types/attribute.types'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { ErrorHandler } from '../../../../utils/error-handler'

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
   * 短いキャラクターIDを生成（8文字）
   */
  private generateShortCharacterId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    const bytes = randomBytes(8)

    for (let i = 0; i < 8; i++) {
      result += chars[bytes[i] % chars.length]
    }

    return result
  }

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
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${character.characterName} - ステータス`)
      .setColor('#e74c3c')
      .setTimestamp()

    if (!character.status || Object.keys(character.status).length === 0) {
      embed.setDescription('ステータス情報がありません。\n編集ボタンから追加してください。')
      return embed
    }

    // statusフィールドを処理
    const fields = this.processCharacterData(character.status, 'ステータス')

    if (fields.length > 0) {
      // Discord Embedの25フィールド制限を考慮
      embed.addFields(...fields.slice(0, 24))

      if (fields.length > 24) {
        embed.setFooter({ text: `${fields.length - 24}個のステータスが省略されています` })
      }
    } else {
      embed.setDescription('表示可能なステータス情報がありません。')
    }

    return embed
  }

  /**
   * パラメータEmbed を作成
   */
  private createParameterEmbed(character: Character): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`⚙️ ${character.characterName} - パラメータ`)
      .setColor('#34495e')
      .setTimestamp()

    if (!character.parameter || Object.keys(character.parameter).length === 0) {
      embed.setDescription('パラメータ情報がありません。\n編集ボタンから追加してください。')
      return embed
    }

    // parameterフィールドを処理
    const fields = this.processCharacterData(character.parameter, 'パラメータ')

    if (fields.length > 0) {
      // Discord Embedの25フィールド制限を考慮
      embed.addFields(...fields.slice(0, 24))

      if (fields.length > 24) {
        embed.setFooter({ text: `${fields.length - 24}個のパラメータが省略されています` })
      }
    } else {
      embed.setDescription('表示可能なパラメータ情報がありません。')
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
    this.logger.debug(`Processing ${dataType} data:`, JSON.stringify(data, null, 2))
    const fields: EmbedField[] = []

    for (const [key, value] of Object.entries(data)) {
      this.logger.debug(`Processing ${dataType} entry - Key: ${key}`)
      this.logger.debug(`Value:`, JSON.stringify(value, null, 2))
      console.log(`[EMBED-MANAGER] Processing ${dataType} - ${key}:`, value)

      if (!value || value === null || value === undefined) {
        this.logger.debug(`Skipping ${key} - null/undefined value`)
        continue
      }

      let fieldValue: string
      let fieldName: string = key

      // AttributeValue型に応じた処理
      if (typeof value === 'object' && value !== null) {
        const attr = value as AttributeValue

        // 表示名は name プロパティを優先
        fieldName = attr.name || key

        // 表示値を構成
        const valueParts: string[] = []

        // values（合計値）がある場合
        if (attr.values && Object.keys(attr.values).length > 0) {
          this.logger.debug(`Processing values for ${fieldName}:`, JSON.stringify(attr.values, null, 2))
          const totalValue = getDisplayNumber(attr)
          this.logger.debug(`Calculated total value for ${fieldName}: ${totalValue}`)
          valueParts.push(`**合計:** ${totalValue}`)

          // 詳細内訳を表示（基本値、バフ等）
          const detailParts: string[] = []
          Object.entries(attr.values).forEach(([partKey, partValue]) => {
            this.logger.debug(`Processing part - Key: ${partKey}, Value: ${partValue}, Type: ${typeof partValue}`)
            console.log(`[EMBED-MANAGER] partKey: ${partKey}, partValue: ${partValue}, type: ${typeof partValue}`)
            if (typeof partValue === 'number' && partValue !== 0) {
              const formattedPart = `${partKey}: ${partValue > 0 ? '+' : ''}${partValue}`
              detailParts.push(formattedPart)
              this.logger.debug(`Added detail part: ${formattedPart}`)
            } else {
              this.logger.debug(`Skipped part - not a number or zero: ${partKey} = ${partValue}`)
            }
          })

          this.logger.debug(`Detail parts for ${fieldName}:`, detailParts)
          if (detailParts.length > 0) {
            const detailText = `(${detailParts.join(', ')})`
            valueParts.push(detailText)
            this.logger.debug(`Added detail text: ${detailText}`)
          }
        }

        // dice（ダイス）がある場合
        if (attr.dice) {
          valueParts.push(`🎲 **ダイス:** ${attr.dice}`)
        }

        // description（説明）がある場合
        if (attr.description) {
          valueParts.push(`💬 ${attr.description}`)
        }

        fieldValue = valueParts.length > 0 ? valueParts.join('\n') : '値が設定されていません'
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

      let name: string
      let rollValue: number

      // データの形式を判定
      if (value && typeof value === 'object') {
        if ('name' in value && 'value' in value) {
          name = value.name as string
          rollValue = Number(value.value) || 0
        } else {
          name = key
          rollValue = Number(value) || 0
        }
      } else {
        name = key
        rollValue = Number(value) || 0
      }

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
      let displayName = key
      let displayValue = String(value)

      // AttributeValue型またはレガシー形式を処理
      if (typeof value === 'object' && value !== null) {
        const attr = value

        this.logger.debug(`Field select menu - processing object: ${key}`, attr)

        if (attr.values && typeof attr.values === 'object') {
          // AttributeValue形式の場合
          displayName = attr.name || key

          // 表示値を構成
          const displayParts: string[] = []

          // values（合計値）がある場合
          if (Object.keys(attr.values).length > 0) {
            const totalValue = getDisplayNumber(attr)
            displayParts.push(`合計: ${totalValue}`)
          }

          // dice（ダイス）がある場合
          if (attr.dice) {
            displayParts.push(`ダイス: ${attr.dice}`)
          }

          // description（説明）がある場合
          if (attr.description) {
            displayParts.push(attr.description)
          }

          displayValue = displayParts.length > 0 ? displayParts.join(' | ') : '設定値なし'
        } else if (attr.name && 'value' in attr) {
          // レガシー形式の場合
          displayName = attr.name || key
          displayValue = String(attr.value || '値なし')
        } else {
          // その他のオブジェクト形式
          displayName = key
          displayValue = 'オブジェクト形式'
        }

        this.logger.debug(`Field select menu - final display: ${displayName} = ${displayValue}`)
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
        characterId: characterData.characterId || this.generateShortCharacterId(),
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
