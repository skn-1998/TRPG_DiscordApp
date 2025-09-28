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
import { ModalSessionManagerService } from './modal-session-manager.service'
import { getDisplayNumber } from '../../../../core/types/attribute.types'
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
    private readonly embedManager: CharacterEmbedManagerService,
    private readonly modalSessionManager: ModalSessionManagerService
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
      if (customId.includes('character-edit-section') || customId.includes('character-section-select')) {
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
    // 「戻る」オプションの処理
    if (sectionType === 'back') {
      await this.showMainSectionMenu(interaction, character)
      return
    }

    // フィールド選択メニューを作成
    const fieldSelectMenu = this.embedManager.createFieldSelectMenu(character, sectionType, character.characterId)

    if (!fieldSelectMenu) {
      await this.sendErrorMessage(interaction, 'セクションの読み込みに失敗しました。')
      return
    }

    // 戻るボタンを追加
    const backSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`character-edit-section-${character.characterId}`)
      .setPlaceholder('別のセクションを選択するか戻る')
      .addOptions({
        label: '⬅️ セクション選択に戻る',
        value: 'back',
        description: 'メインのセクション選択画面に戻ります'
      })

    const fieldRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelectMenu)
    const backRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(backSelectMenu)

    // セクション名を取得
    const sectionNames: Record<Exclude<EmbedSectionType, 'back'>, string> = {
      status: 'ステータス',
      parameter: 'パラメータ',
      skill: 'スキル',
      item: 'アイテム',
      basic: '基本情報'
    }

    // 元のEmbedを保持
    const originalEmbeds = interaction.message.embeds

    await interaction.editReply({
      embeds: originalEmbeds,
      components: [fieldRow, backRow]
    })
  }

  /**
   * メインセクション選択画面を表示
   */
  private async showMainSectionMenu(interaction: StringSelectMenuInteraction, character: Character): Promise<void> {
    // 元の分割Embedに戻す
    const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)

    await interaction.editReply({
      embeds,
      components
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
    let fieldName = ''
    let currentValues = ''
    let currentDice = ''
    let currentDescription = ''

    if (!isNewField) {
      // 既存フィールドの値を取得
      const sectionData = this.getSectionData(character, sectionType) as Record<string, unknown> | undefined
      if (sectionData && fieldKey in sectionData) {
        const fieldValue = sectionData[fieldKey]

        if (typeof fieldValue === 'object' && fieldValue !== null) {
          const attr = fieldValue as any

          if (attr.values && typeof attr.values === 'object') {
            // AttributeValue形式の場合
            fieldName = attr.name || fieldKey

            // valuesを文字列として取得
            if (Object.keys(attr.values).length > 0) {
              const total = getDisplayNumber(attr)
              currentValues = String(total)
            }

            // dice値を取得
            if (attr.dice) {
              currentDice = String(attr.dice)
            }

            // description値を取得
            if (attr.description) {
              currentDescription = String(attr.description)
            }
          } else {
            // レガシー形式の場合は適切にマッピング
            type NamedValued = { name?: unknown; value?: unknown }
            if ('name' in attr && 'value' in attr) {
              const fv = attr as NamedValued
              fieldName = (typeof fv.name === 'string' && fv.name) || fieldKey

              // 数値かどうかチェック
              const numericValue = parseFloat(String(fv.value ?? ''))
              if (!isNaN(numericValue)) {
                currentValues = String(numericValue)
              } else {
                currentDescription = String(fv.value ?? '')
              }
            }
          }
        } else {
          // プリミティブ値の場合
          const numericValue = parseFloat(String(fieldValue))
          if (!isNaN(numericValue)) {
            currentValues = String(numericValue)
          } else {
            currentDescription = String(fieldValue)
          }
        }

        this.logger.debug(
          `Field selection debug - fieldKey: ${fieldKey}, values: "${currentValues}", dice: "${currentDice}", description: "${currentDescription}"`
        )
      }
      fieldName = fieldName || fieldKey
    }

    // モーダルを作成
    const modal = await this.createEditModal(
      character.characterId,
      sectionType,
      fieldKey,
      fieldName,
      currentValues,
      currentDice,
      currentDescription,
      isNewField
    )

    await interaction.showModal(modal)
  }

  /**
   * 編集モーダルを作成（3フィールド統一版）
   */
  private async createEditModal(
    characterId: string,
    sectionType: EmbedSectionType,
    fieldKey: string,
    fieldName: string,
    currentValues: string,
    currentDice: string,
    currentDescription: string,
    isNew: boolean
  ): Promise<ModalBuilder> {
    const sectionNames: Record<Exclude<EmbedSectionType, 'back'>, string> = {
      status: 'ステータス',
      parameter: 'パラメータ',
      skill: 'スキル',
      item: 'アイテム',
      basic: '基本情報'
    }

    // 新しいキャラクター（短いID）は直接CustomIDを使用、長いIDのみセッション管理
    let modalId: string
    if (characterId.length <= 8) {
      // 短いIDの場合は直接CustomIDを使用
      modalId = `char-edit-${sectionType}-${fieldKey}-${characterId}`
      this.logger.debug(`Using direct CustomID for short character ID: ${modalId}`)
    } else {
      // 長いIDの場合はセッション管理を使用
      const sessionId = this.modalSessionManager.createSession(characterId, sectionType, fieldKey)
      modalId = `char-edit-modal-${sessionId}`
      this.logger.debug(`Using session-based CustomID for long character ID: ${modalId}`)
    }
    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle(`${sectionNames[sectionType as Exclude<EmbedSectionType, 'back'>]}${isNew ? '追加' : '編集'}`)

    // すべてのケースで統一された4フィールド構造

    // 1. 項目名
    const nameInput = new TextInputBuilder()
      .setCustomId('field-name')
      .setLabel('項目名')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: HP, MP, 攻撃力')
      .setRequired(isNew) // 新規時のみ必須
      .setMaxLength(100)

    if (!isNew && fieldName) {
      nameInput.setValue(fieldName)
    }
    const nameRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)

    // 2. 数値 (values.base)
    const valuesInput = new TextInputBuilder()
      .setCustomId('field-values')
      .setLabel('数値')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 100, 50, 20 (数値の場合)')
      .setRequired(false)
      .setMaxLength(50)

    if (currentValues && currentValues.trim() !== '') {
      valuesInput.setValue(currentValues.trim())
    }
    const valuesRow = new ActionRowBuilder<TextInputBuilder>().addComponents(valuesInput)

    // 3. ダイス記法
    const diceInput = new TextInputBuilder()
      .setCustomId('field-dice')
      .setLabel('ダイス記法')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: 3d6+2, 1d20+5')
      .setRequired(false)
      .setMaxLength(100)

    if (currentDice && currentDice.trim() !== '') {
      diceInput.setValue(currentDice.trim())
    }
    const diceRow = new ActionRowBuilder<TextInputBuilder>().addComponents(diceInput)

    // 4. 説明・備考
    const descriptionInput = new TextInputBuilder()
      .setCustomId('field-description')
      .setLabel('説明・備考')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('例: 魔法の剣、特殊効果の説明など')
      .setRequired(false)
      .setMaxLength(1000)

    if (currentDescription && currentDescription.trim() !== '') {
      // Discord TextInputの制限に合わせて値をサニタイズ
      let sanitizedDescription = currentDescription.trim()

      // 最大長制限
      if (sanitizedDescription.length > 1000) {
        sanitizedDescription = sanitizedDescription.substring(0, 997) + '...'
      }

      descriptionInput.setValue(sanitizedDescription)
    }
    const descriptionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput)

    modal.addComponents(nameRow, valuesRow, diceRow, descriptionRow)

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
        const character = result.character as any
        // Mongooseドキュメントの場合は適切に変換
        if (character.toObject) {
          return character.toObject()
        }
        return character
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
      case 'status':
        return character.status
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
    const patterns = [
      /character-edit-section-(.+)/,
      /character-field-edit-\w+-(.+)/,
      /character-field-add-\w+-(.+)/,
      /character-section-select-(.+)/ // character-ui.service.tsからのパターンも対応
    ]

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
    if (customId.includes('-status-')) return 'status'
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
