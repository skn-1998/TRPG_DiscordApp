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
  StringSelectMenuBuilder
} from 'discord.js'
import { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { CharacterService } from '../../../../domains/character/character.service'
import { respondEphemeralError } from '../../../utils/interaction-error-response.util'
import { CharacterEmbedManagerService, EmbedSectionType } from './character-embed-manager.service'
import { ModalSessionManagerService } from './modal-session-manager.service'
import {
  extractFieldEditValues,
  extractSectionFromCustomId,
  isFieldOperationCustomId,
  buildDirectModalId,
  buildSessionModalId,
  shouldUseDirectModalId,
  buildModalTitle,
  sanitizeDescriptionValue,
  getSectionData
} from './character-section-editor.util'
import { extractCharacterIdFromCustomId } from '../utils/enhanced-character-edit.util'
// P1-D slice1: customId 生成を feature-local 契約モジュールへ集約（byte-identical・挙動不変）
import { CharacterSectionCustomId } from '../custom-id'
// import { discordSelectMenuType } from '../../../discord.type'

@Injectable()
export class CharacterSectionEditorService {
  private readonly logger = new Logger(CharacterSectionEditorService.name)

  constructor(
    private readonly characterService: CharacterService,
    private readonly embedManager: CharacterEmbedManagerService,
    private readonly modalSessionManager: ModalSessionManagerService
  ) {}

  async handleSectionSelectInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.executeSelectAction(interaction, async () => {
      await interaction.deferUpdate()
      const selectedValue = interaction.values[0]
      const character = await this.getCharacterForInteraction(interaction)
      if (!character) return

      await this.handleSectionSelection(interaction, character, selectedValue as EmbedSectionType)
    })
  }

  async handleFieldSelectInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    await this.executeSelectAction(interaction, async () => {
      if (!isFieldOperationCustomId(interaction.customId)) {
        // Invariant: Registry の field pattern を通過し得る理論クラスを拒否し、契約 drift を可視化する。
        await interaction.deferUpdate()
        this.logger.warn(`Unsupported character field customId: ${interaction.customId}`)
        await this.sendErrorMessage(interaction, '⚠️ このインタラクションは現在処理できません。')
        return
      }

      const selectedValue = interaction.values[0]
      const character = await this.getCharacterForInteraction(interaction)
      if (!character) return

      const sectionType = extractSectionFromCustomId(interaction.customId)
      if (sectionType) {
        await this.handleFieldSelection(interaction, character, sectionType, selectedValue)
      }
    })
  }

  private async getCharacterForInteraction(interaction: StringSelectMenuInteraction): Promise<CharacterEntity | null> {
    const characterId = extractCharacterIdFromCustomId(interaction.customId)
    if (!characterId) {
      await this.sendErrorMessage(interaction, 'キャラクター情報の取得に失敗しました。')
      return null
    }

    const character = await this.getCharacter(characterId)
    if (!character) {
      await this.sendErrorMessage(interaction, 'キャラクターが見つかりません。')
      return null
    }

    return character
  }

  private async executeSelectAction(
    interaction: StringSelectMenuInteraction,
    action: () => Promise<void>
  ): Promise<void> {
    try {
      await action()
    } catch (error) {
      try {
        await this.sendErrorMessage(interaction, 'エラーが発生しました。もう一度お試しください。')
      } catch (notificationError) {
        this.logger.warn('Failed to send character section editor error response', notificationError)
      }

      throw error
    }
  }

  /**
   * セクション選択の処理
   */
  private async handleSectionSelection(
    interaction: StringSelectMenuInteraction,
    character: CharacterEntity,
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
      .setCustomId(CharacterSectionCustomId.createEditSection(character.characterId))
      .setPlaceholder('別のセクションを選択するか戻る')
      .addOptions({
        label: '⬅️ セクション選択に戻る',
        value: 'back',
        description: 'メインのセクション選択画面に戻ります'
      })

    const fieldRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelectMenu)
    const backRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(backSelectMenu)

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
  private async showMainSectionMenu(
    interaction: StringSelectMenuInteraction,
    character: CharacterEntity
  ): Promise<void> {
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
    character: CharacterEntity,
    sectionType: EmbedSectionType,
    fieldKey: string
  ): Promise<void> {
    const isNewField = fieldKey === 'add_new'

    // 既存値の抽出は純粋関数に委譲（AttributeValue / レガシー / プリミティブの 3 分岐）
    const { fieldName, currentValues, currentDice, currentDescription } = isNewField
      ? { fieldName: '', currentValues: '', currentDice: '', currentDescription: '' }
      : extractFieldEditValues(getSectionData(character, sectionType), fieldKey)

    if (!isNewField) {
      this.logger.debug(
        `Field selection debug - fieldKey: ${fieldKey}, values: "${currentValues}", dice: "${currentDice}", description: "${currentDescription}"`
      )
    }

    // モーダルを作成
    const modal = this.createEditModal(
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
   * 編集モーダルを作成（4フィールド統一版）
   *
   * modal customId の決定は純粋ロジック（短いIDは直接生成）と
   * session 採番（modalSessionManager 副作用）を分離している。
   */
  private createEditModal(
    characterId: string,
    sectionType: EmbedSectionType,
    fieldKey: string,
    fieldName: string,
    currentValues: string,
    currentDice: string,
    currentDescription: string,
    isNew: boolean
  ): ModalBuilder {
    const modalId = this.resolveModalId(characterId, sectionType, fieldKey)
    const modal = new ModalBuilder().setCustomId(modalId).setTitle(buildModalTitle(sectionType, isNew))

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

    // 2. 数値（values の合算値。保存時に base へ逆算: character-modal-handler.util.ts 参照）
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
      // Discord TextInput の制限に合わせて値をサニタイズ（純粋関数）
      descriptionInput.setValue(sanitizeDescriptionValue(currentDescription))
    }
    const descriptionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput)

    modal.addComponents(nameRow, valuesRow, diceRow, descriptionRow)

    return modal
  }

  /**
   * キャラクター情報を取得
   */
  private async getCharacter(characterId: string): Promise<CharacterEntity | null> {
    try {
      // 同一プロセス内クエリのため CharacterService を直接呼び出す（E-2b: イベント RPC 廃止）
      // E-6d: repository 境界で plain 化が保証されるため toObject ガードは不要
      return await this.characterService.findOne(characterId)
    } catch (error) {
      this.logger.error(`Failed to get character: ${characterId}`, error)
      return null
    }
  }

  /**
   * modal customId を決定する（純粋部分 + session 採番の副作用境界）。
   *
   * 短いID（<=8）は純粋関数で直接生成、長いIDのみ modalSessionManager で session 採番。
   * 副作用（createSession）をこのメソッドに隔離している。
   */
  private resolveModalId(characterId: string, sectionType: EmbedSectionType, fieldKey: string): string {
    if (shouldUseDirectModalId(characterId)) {
      const modalId = buildDirectModalId(sectionType, fieldKey, characterId)
      this.logger.debug(`Using direct CustomID for short character ID: ${modalId}`)
      return modalId
    }
    const sessionId = this.modalSessionManager.createSession(characterId, sectionType, fieldKey)
    const modalId = buildSessionModalId(sessionId)
    this.logger.debug(`Using session-based CustomID for long character ID: ${modalId}`)
    return modalId
  }

  /**
   * エラーメッセージを送信
   */
  private async sendErrorMessage(interaction: StringSelectMenuInteraction, message: string): Promise<void> {
    // NOTE: 規約例外 - deferUpdate 後の editReply は公開キャラシートをエラー表示で置換し、
    // components も失わせるため、本人だけに届く followUp で元メッセージを保護する。
    await respondEphemeralError(interaction, message, { deferredStrategy: 'followUp' })
  }
}
