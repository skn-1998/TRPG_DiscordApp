/**
 * Character Section Editor Service
 *
 * キャラクターの各セクション（Status/Skill/Parameter）の編集機能を提供
 * セレクトメニューとモーダルを使用した編集インターフェース
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder
} from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { ErrorHandler } from '../../../../utils/error-handler'
import { CharacterEmbedManagerService, EmbedSectionType } from './character-embed-manager.service'
// import { discordSelectMenuType } from '../../../discord.type'

/**
 * フィールド編集データ
 */
export interface FieldEditData {
  section: EmbedSectionType
  field: string
  value: string
  isNew: boolean
}

@Injectable()
export class CharacterSectionEditorService {
  private readonly logger = new Logger(CharacterSectionEditorService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly embedManager: CharacterEmbedManagerService
  ) {}

  /**
   * セクション選択メニューの処理
   */
  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      const customId = interaction.customId
      const isFieldOperation = customId.includes('character-field-edit') || customId.includes('character-field-add')

      // フィールド編集/追加（モーダル表示）の場合は defer しない
      if (!isFieldOperation) {
        await interaction.deferUpdate()
      }
      const selectedValues = interaction.values

      // カスタムIDからcharacterIdを抽出
      const characterId = this.extractCharacterIdFromCustomId(customId)
      if (!characterId) {
        await this.sendErrorMessage(interaction, 'キャラクター情報の取得に失敗しました。')
        return
      }

      // キャラクター情報を取得
      const character = await this.getCharacter(characterId)
      if (!character) {
        await this.sendErrorMessage(interaction, 'キャラクターが見つかりません。')
        return
      }

      // セクション選択の処理（メッセージ更新）
      if (customId.includes('character-edit-section')) {
        await this.handleSectionSelection(interaction, character, selectedValues[0] as EmbedSectionType)
      }
      // フィールド編集の処理
      else if (isFieldOperation) {
        const sectionType = this.extractSectionFromCustomId(customId)
        if (sectionType) {
          await this.handleFieldSelection(interaction, character, sectionType, selectedValues[0])
        }
      }
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          customId: interaction.customId,
          userId: interaction.user.id
        },
        'CharacterSectionEditorService'
      )

      await this.sendErrorMessage(interaction, 'エラーが発生しました。もう一度お試しください。')
    }
  }

  /**
   * セクション選択の処理
   */
  private async handleSectionSelection(
    interaction: StringSelectMenuInteraction,
    character: Character,
    sectionType: EmbedSectionType
  ): Promise<void> {
    // フィールド選択メニューを作成
    const fieldSelectMenu = this.embedManager.createFieldSelectMenu(character, sectionType, character.characterId)

    if (!fieldSelectMenu) {
      await this.sendErrorMessage(interaction, 'セクションの読み込みに失敗しました。')
      return
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelectMenu)

    // セクション名を取得
    const sectionNames = {
      status: 'ステータス',
      parameter: 'パラメータ',
      skill: 'スキル',
      item: 'アイテム',
      basic: '基本情報'
    }

    const embed = new EmbedBuilder()
      .setTitle(`${sectionNames[sectionType]}編集`)
      .setDescription(
        `${character.characterName}の${sectionNames[sectionType]}を編集します。\n下のメニューから編集したい項目を選択してください。`
      )
      .setColor('#3498db')

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    })
  }

  /**
   * フィールド選択の処理
   */
  private async handleFieldSelection(
    interaction: StringSelectMenuInteraction,
    character: Character,
    sectionType: EmbedSectionType,
    fieldKey: string
  ): Promise<void> {
    const isNewField = fieldKey === 'add_new'
    let currentValue = ''
    let fieldName = ''

    if (!isNewField) {
      // 既存フィールドの値を取得
      const sectionData = this.getSectionData(character, sectionType) as Record<string, unknown> | undefined
      if (sectionData && fieldKey in sectionData) {
        const fieldValue = sectionData[fieldKey]

        if (typeof fieldValue === 'object' && fieldValue !== null) {
          type NamedValued = { name?: unknown; value?: unknown }
          if (
            typeof fieldValue === 'object' &&
            fieldValue !== null &&
            'name' in (fieldValue as NamedValued) &&
            'value' in (fieldValue as NamedValued)
          ) {
            const fv = fieldValue as NamedValued
            fieldName = (typeof fv.name === 'string' && fv.name) || fieldKey
            currentValue = String(fv.value ?? '')
          } else {
            currentValue = JSON.stringify(fieldValue, null, 2)
          }
        } else {
          currentValue = String(fieldValue)
        }
      }
      fieldName = fieldName || fieldKey
    }

    // モーダルを作成
    const modal = await this.createEditModal(
      character.characterId,
      sectionType,
      fieldKey,
      fieldName,
      currentValue,
      isNewField
    )

    await interaction.showModal(modal)
  }

  /**
   * 編集モーダルを作成
   */
  private async createEditModal(
    characterId: string,
    sectionType: EmbedSectionType,
    fieldKey: string,
    fieldName: string,
    currentValue: string,
    isNew: boolean
  ): Promise<ModalBuilder> {
    const sectionNames = {
      status: 'ステータス',
      parameter: 'パラメータ',
      skill: 'スキル',
      item: 'アイテム',
      basic: '基本情報'
    }

    // フォーマットを characterId 末尾に統一
    const modalId = `character-edit-modal-${sectionType}-${fieldKey}-${characterId}`
    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle(`${sectionNames[sectionType]}${isNew ? '追加' : '編集'}`)

    // フィールド名入力（新規の場合のみ）
    if (isNew) {
      const nameInput = new TextInputBuilder()
        .setCustomId('field-name')
        .setLabel('項目名')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('例: HP, MP, 攻撃力')
        .setRequired(true)
        .setMaxLength(100)

      const nameRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)
      modal.addComponents(nameRow)
    }

    // 値入力
    const valueInput = new TextInputBuilder()
      .setCustomId('field-value')
      .setLabel(isNew ? '値' : `${fieldName}の値`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 100, 3d6+2, 魔法の剣')
      .setRequired(true)
      .setMaxLength(1000)

    if (currentValue) {
      valueInput.setValue(currentValue)
    }

    const valueRow = new ActionRowBuilder<TextInputBuilder>().addComponents(valueInput)
    modal.addComponents(valueRow)

    // 詳細説明（オプション）
    const descInput = new TextInputBuilder()
      .setCustomId('field-description')
      .setLabel('説明（任意）')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('この項目の詳細説明や効果など')
      .setRequired(false)
      .setMaxLength(2000)

    const descRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
    modal.addComponents(descRow)

    return modal
  }

  /**
   * キャラクター情報を取得
   */
  private async getCharacter(characterId: string): Promise<Character | null> {
    try {
      // 先に待受をセットしてからemit（レースコンディション回避）
      const resultPromise = Promise.race([
        this.typedEventService.waitForEvent('character.findById.completed', 5000),
        this.typedEventService.waitForEvent('character.findById.failed', 5000)
      ])

      // イベントを発行してキャラクター情報を取得
      await this.typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'character-section-editor',
        timestamp: new Date()
      })

      // 結果を待機
      const result = await resultPromise

      if ('character' in result && result.character) {
        return result.character
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to get character: ${characterId}`, error)
      return null
    }
  }

  /**
   * セクションデータを取得
   */
  private getSectionData(character: Character, sectionType: EmbedSectionType): Record<string, unknown> | undefined {
    switch (sectionType) {
      case 'parameter':
        return character.parameter
      case 'skill':
        return character.skill
      case 'item':
        return character.item
      default:
        return undefined
    }
  }

  /**
   * カスタムIDからキャラクターIDを抽出
   */
  private extractCharacterIdFromCustomId(customId: string): string | null {
    const patterns = [/character-edit-section-(.+)/, /character-field-edit-\w+-(.+)/, /character-field-add-\w+-(.+)/]

    for (const pattern of patterns) {
      const match = customId.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }

    return null
  }

  /**
   * カスタムIDからセクションタイプを抽出
   */
  private extractSectionFromCustomId(customId: string): EmbedSectionType | null {
    if (customId.includes('-parameter-')) return 'parameter'
    if (customId.includes('-skill-')) return 'skill'
    if (customId.includes('-item-')) return 'item'
    return null
  }

  /**
   * エラーメッセージを送信
   */
  private async sendErrorMessage(interaction: StringSelectMenuInteraction, message: string): Promise<void> {
    const embed = new EmbedBuilder().setTitle('❌ エラー').setDescription(message).setColor('#e74c3c')

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [embed],
        components: []
      })
    } else {
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      })
    }
  }
}
