/**
 * Character Modal Handler Service
 *
 * キャラクター編集モーダルの送信処理を担当
 * フィールドの追加・更新・削除機能を提供
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  Message,
  Collection
} from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { UpdateCharacterDto } from '../../../../domains/character/dto/update-character.dto'
import { CharacterInputDto, AttributeValueDto } from '../../../../domains/character/dto/create-character.dto'
import { AttributeValue } from '../../../../core/types/attribute.types'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { ErrorHandler } from '../../../../utils/error-handler'
import { CharacterEmbedManagerService, EmbedSectionType } from './character-embed-manager.service'
import { ModalSessionManagerService } from './modal-session-manager.service'

/**
 * フィールドデータ構造
 */
export interface FieldData {
  name?: string
  values?: string
  dice?: string
  description?: string
}

@Injectable()
export class CharacterModalHandlerService {
  private readonly logger = new Logger(CharacterModalHandlerService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly embedManager: CharacterEmbedManagerService,
    private readonly modalSessionManager: ModalSessionManagerService
  ) {}

  /**
   * モーダル送信の処理
   */
  async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      this.logger.log(`Modal submit received: ${interaction.customId}`)
      await interaction.deferReply({ ephemeral: true })

      // キャラクター作成モーダルかどうかを確認
      if (interaction.customId.includes('character-create-basic')) {
        this.logger.debug('Processing character creation modal')
        await this.handleCharacterCreation(interaction)
        return
      }

      // 既存のキャラクター編集処理
      this.logger.debug('Processing character edit modal')
      await this.handleCharacterEdit(interaction)
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          customId: interaction.customId,
          userId: interaction.user.id
        },
        'CharacterModalHandlerService'
      )

      await this.sendErrorResponse(interaction, 'エラーが発生しました。もう一度お試しください。')
    }
  }

  /**
   * キャラクター作成の処理
   */
  private async handleCharacterCreation(interaction: ModalSubmitInteraction): Promise<void> {
    // フォームデータを取得
    const characterData = this.extractCharacterCreationData(interaction)
    if (!characterData) {
      await this.sendErrorResponse(interaction, 'キャラクター作成データの取得に失敗しました。')
      return
    }

    // カスタムIDからchannelIdとuserIdを抽出
    const { channelId, userId } = this.parseCreationCustomId(interaction.customId)
    if (!channelId || !userId) {
      await this.sendErrorResponse(interaction, 'チャンネル情報の取得に失敗しました。')
      return
    }

    // キャラクターを作成
    const character = await this.embedManager.createCharacter(characterData, channelId, userId)

    if (character) {
      // 成功メッセージ
      const successEmbed = this.embedManager.createCharacterCreatedEmbed(character)
      await interaction.editReply({
        embeds: [successEmbed],
        components: []
      })

      // キャラクター編集Embedをチャンネルに送信（新規作成の場合は常に新メッセージ）
      if (interaction.channel && 'send' in interaction.channel) {
        const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)
        await interaction.channel.send({
          content: `🎉 新しいキャラクター **${character.characterName}** が作成されました！`,
          embeds,
          components
        })
      }
    } else {
      await this.sendErrorResponse(interaction, 'キャラクターの作成に失敗しました。')
    }
  }

  /**
   * キャラクター編集の処理（既存）
   */
  private async handleCharacterEdit(interaction: ModalSubmitInteraction): Promise<void> {
    this.logger.log(`Handling character edit for customId: ${interaction.customId}`)

    // カスタムIDを解析
    const { characterId, sectionType, fieldKey } = this.parseModalCustomId(interaction.customId)

    this.logger.debug(`Parsed modal data: characterId=${characterId}, sectionType=${sectionType}, fieldKey=${fieldKey}`)

    if (!characterId || !sectionType || !fieldKey) {
      this.logger.error(`Failed to parse modal customId: ${interaction.customId}`)
      await this.sendErrorResponse(interaction, 'モーダル情報の解析に失敗しました。')
      return
    }

    // フォーム値を取得
    const formData = this.extractFormData(interaction)
    if (!formData) {
      await this.sendErrorResponse(interaction, 'フォームデータの取得に失敗しました。')
      return
    }

    // キャラクター情報を取得
    const character = await this.getCharacter(characterId)
    if (!character) {
      await this.sendErrorResponse(interaction, 'キャラクターが見つかりません。')
      return
    }

    // フィールドを更新
    const success = await this.updateCharacterField(
      character,
      sectionType,
      fieldKey as string, // nullチェック済み
      formData
    )

    if (success) {
      // 成功レスポンスは送信せず、静かに更新を完了

      // 最新のキャラクター情報を再取得してEmbedを更新
      // データベース更新が確実に反映されるよう待機
      await new Promise((resolve) => setTimeout(resolve, 200))

      this.logger.debug(`Attempting to retrieve updated character data: ${character.characterId}`)
      const updatedCharacter = await this.getCharacter(character.characterId)
      if (updatedCharacter) {
        this.logger.log(`Successfully retrieved updated character data, updating embed for: ${character.characterId}`)
        await this.updateExistingCharacterEditEmbed(updatedCharacter, interaction)
      } else {
        this.logger.warn(
          `Failed to get updated character for embed update: ${character.characterId}, using original data`
        )
        // フォールバック: 元のキャラクター情報でEmbed更新
        await this.updateExistingCharacterEditEmbed(character, interaction)
      }

      // セクション編集のEmbedとメニューをクリア
      await this.clearSectionEditEmbed(interaction, character.characterId)

      // 成功時は何もレスポンスを返さずに静かに完了
      await interaction.deleteReply().catch(() => {
        // deleteに失敗した場合は無視（既に削除済みなど）
      })
    } else {
      await this.sendErrorResponse(interaction, 'キャラクター情報の更新に失敗しました。')
    }
  }

  /**
   * モーダルのカスタムIDを解析
   */
  private parseModalCustomId(customId: string): {
    characterId: string | null
    sectionType: EmbedSectionType | null
    fieldKey: string | null
  } {
    this.logger.debug(`Parsing modal customId: ${customId}`)

    // セッションベース形式: char-edit-modal-{sessionId}
    const sessionFormatPrefix = 'char-edit-modal-'
    if (customId.startsWith(sessionFormatPrefix)) {
      const sessionId = customId.slice(sessionFormatPrefix.length)
      this.logger.debug(`Using session-based customId with sessionId: ${sessionId}`)

      // ModalSessionManagerServiceからセッションデータを取得
      const sessionData = this.modalSessionManager.getSession(sessionId)
      if (sessionData) {
        this.logger.debug(`Session found: ${JSON.stringify(sessionData)}`)
        // セッション使用後は削除
        this.modalSessionManager.removeSession(sessionId)
        return {
          characterId: sessionData.characterId,
          sectionType: sessionData.sectionType,
          fieldKey: sessionData.fieldKey
        }
      } else {
        this.logger.warn(`Session not found for sessionId: ${sessionId}`)
        return { characterId: null, sectionType: null, fieldKey: null }
      }
    }

    // 従来の形式をサポート（後方互換）
    const oldFormatPrefix = 'char-edit-'
    if (customId.startsWith(oldFormatPrefix) && !customId.startsWith(sessionFormatPrefix)) {
      const rest = customId.slice(oldFormatPrefix.length)
      const parts = rest.split('-')
      this.logger.debug(`Using legacy format, CustomId parts: ${JSON.stringify(parts)}`)

      if (parts.length < 3) {
        this.logger.warn(`CustomId has insufficient parts: ${parts.length}, expected at least 3`)
        return { characterId: null, sectionType: null, fieldKey: null }
      }

      const sectionType = parts[0] as EmbedSectionType
      const fieldKey = parts[1]
      const characterId = parts.slice(2).join('-')

      this.logger.debug(`Legacy parsed: sectionType=${sectionType}, fieldKey=${fieldKey}, characterId=${characterId}`)

      return { characterId, sectionType, fieldKey }
    }

    this.logger.warn(`CustomId format not recognized: ${customId}`)
    return { characterId: null, sectionType: null, fieldKey: null }
  }

  /**
   * フォームデータを抽出
   */
  private extractFormData(interaction: ModalSubmitInteraction): FieldData | null {
    try {
      let name: string | undefined = undefined
      let values: string | undefined = undefined
      let dice: string | undefined = undefined
      let description: string | undefined = undefined

      // field-name フィールド（新規追加時）
      try {
        const rawName = interaction.fields.getTextInputValue('field-name')
        name = rawName?.trim() || undefined
        this.logger.debug(`Raw field-name value: "${rawName}" -> processed: "${name}"`)
      } catch (error) {
        this.logger.debug('field-name field not found')
      }

      // 新しい3フィールド形式をチェック
      try {
        const rawValues = interaction.fields.getTextInputValue('field-values')
        values = rawValues?.trim() || undefined
        this.logger.debug(`Raw field-values: "${rawValues}"`)
      } catch (error) {
        // field-values フィールドが存在しない場合
      }

      try {
        const rawDice = interaction.fields.getTextInputValue('field-dice')
        dice = rawDice?.trim() || undefined
        this.logger.debug(`Raw field-dice: "${rawDice}"`)
      } catch (error) {
        // field-dice フィールドが存在しない場合
      }

      try {
        const rawDescription = interaction.fields.getTextInputValue('field-description')
        description = rawDescription?.trim() || undefined
        this.logger.debug(`Raw field-description: "${rawDescription}"`)
      } catch (error) {
        // field-description フィールドが存在しない場合
      }

      // データの有効性をチェック
      if (!values && !dice && !description) {
        this.logger.warn('No valid data found in form fields - values, dice, and description are all empty')
        return null
      }

      return {
        name,
        values,
        dice,
        description
      }
    } catch (error) {
      this.logger.error('Failed to extract form data', error)
      return null
    }
  }

  /**
   * キャラクターフィールドを更新
   */
  private async updateCharacterField(
    character: Character,
    sectionType: EmbedSectionType,
    fieldKey: string,
    formData: FieldData
  ): Promise<boolean> {
    try {
      // 更新するセクションのデータを取得
      const sectionData: Record<string, unknown> = { ...(this.getSectionData(character, sectionType) ?? {}) }

      this.logger.debug(`Raw form data for ${character.characterId}:`, {
        name: formData.name,
        values: formData.values,
        dice: formData.dice,
        description: formData.description,
        sectionType,
        fieldKey,
        isNewField: fieldKey === 'add_new'
      })

      // フィールドキーを決定（新規の場合はフォームの名前を使用）
      const actualFieldKey = fieldKey === 'add_new' ? formData.name || `new_${Date.now()}` : fieldKey

      // nameの決定: フォームのnameがある場合は使用、なければactualFieldKeyを使用
      const finalName = formData.name && formData.name.trim() !== '' ? formData.name.trim() : actualFieldKey

      // AttributeValue形式でフィールドデータを構築
      const valuesObj: Record<string, number> = {}

      // values フィールドの処理
      if (formData.values && formData.values.trim() !== '') {
        const numericValue = parseFloat(formData.values.trim())
        if (!isNaN(numericValue)) {
          valuesObj.base = numericValue
        }
      }

      const attributeValue = {
        name: finalName,
        index: null,
        values: valuesObj,
        description: formData.description || null,
        dice: formData.dice || null,
        isVisible: true
      }

      this.logger.debug(`Creating AttributeValue for ${actualFieldKey}:`, JSON.stringify(attributeValue, null, 2))

      // 値が有効かチェック
      if (
        !finalName ||
        (Object.keys(attributeValue.values).length === 0 && !attributeValue.description && !attributeValue.dice)
      ) {
        this.logger.error(`Invalid data for field ${actualFieldKey}: no name or values/description/dice`)
        return false
      }

      // セクションデータを更新
      sectionData[actualFieldKey] = attributeValue

      // 更新DTOを作成
      let updateData: UpdateCharacterDto

      switch (sectionType) {
        case 'status':
          updateData = { status: sectionData as Record<string, AttributeValueDto> }
          break
        case 'parameter':
          updateData = { parameter: sectionData as Record<string, AttributeValueDto> }
          break
        case 'skill':
          updateData = { skill: sectionData as Record<string, AttributeValueDto> }
          break
        case 'item':
          updateData = { item: sectionData as Record<string, AttributeValueDto> }
          break
        default:
          return false
      }

      // 先に待受をセットしてからemit（レースコンディション回避）
      const resultPromise = Promise.race([
        this.typedEventService.waitForEvent('character.update.completed', 5000),
        this.typedEventService.waitForEvent('character.update.failed', 5000)
      ])

      // キャラクター更新イベントを発行
      await this.typedEventService.emit('character.update.requested', {
        characterId: character.characterId,
        channelId: character.discordChannelId || '',
        updateData,
        userId: character.discordUserId,
        source: 'character-modal-handler',
        timestamp: new Date()
      } as any)

      // 更新完了を待機
      const result = await resultPromise

      if ('character' in result) {
        this.logger.log(
          `Character field updated successfully: ${character.characterId} - ${sectionType}.${actualFieldKey}`
        )
        this.logger.debug(`Updated field value: ${JSON.stringify(attributeValue)}`)
        return true
      } else {
        this.logger.error(`Character update failed: ${character.characterId}`, result)
        return false
      }
    } catch (error) {
      this.logger.error('Failed to update character field', error)
      return false
    }
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

      await this.typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'character-modal-handler',
        timestamp: new Date()
      })

      const result = await resultPromise

      if ('character' in result && result.character) {
        return result.character as Character
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
   * 成功レスポンスを送信
   */
  private async sendSuccessResponse(
    interaction: ModalSubmitInteraction,
    sectionType: EmbedSectionType,
    fieldName: string
  ): Promise<void> {
    const sectionNames: Record<Exclude<EmbedSectionType, 'back'>, string> = {
      status: 'ステータス',
      parameter: 'パラメータ',
      skill: 'スキル',
      item: 'アイテム',
      basic: '基本情報'
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ 更新完了')
      .setDescription(
        `${sectionNames[sectionType as Exclude<EmbedSectionType, 'back'>]}「${fieldName}」を更新しました。`
      )
      .setColor('#27ae60')
      .setTimestamp()

    const refreshButton = new ButtonBuilder()
      .setCustomId('character-refresh-embeds')
      .setLabel('🔄 表示を更新')
      .setStyle(ButtonStyle.Primary)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(refreshButton)

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    })
  }

  /**
   * エラーレスポンスを送信
   */
  private async sendErrorResponse(interaction: ModalSubmitInteraction, message: string): Promise<void> {
    const embed = new EmbedBuilder().setTitle('❌ エラー').setDescription(message).setColor('#e74c3c').setTimestamp()

    await interaction.editReply({
      embeds: [embed],
      components: []
    })
  }

  /**
   * キャラクター作成データを抽出
   */
  private extractCharacterCreationData(interaction: ModalSubmitInteraction): CharacterInputDto | null {
    try {
      const characterName = interaction.fields.getTextInputValue('character-name')
      const gameSystemId = interaction.fields.getTextInputValue('game-system') || ''

      if (!characterName || characterName.trim() === '') {
        return null
      }

      return {
        characterName: characterName.trim(),
        gameSystemId: gameSystemId.trim(),
        discordUserId: interaction.user.id,
        discordChannelId: interaction.channelId || undefined
      }
    } catch (error) {
      this.logger.error('Failed to extract character creation data', error)
      return null
    }
  }

  /**
   * 作成モーダルのカスタムIDを解析
   */
  private parseCreationCustomId(customId: string): {
    channelId: string | null
    userId: string | null
  } {
    // character-create-basic-{channelId}-{userId}
    const pattern = /character-create-basic-(.+?)-(.+)$/
    const match = customId.match(pattern)

    if (!match) {
      return { channelId: null, userId: null }
    }

    return {
      channelId: match[1],
      userId: match[2]
    }
  }

  /**
   * 既存のcharacterEditEmbedを更新
   */
  private async updateExistingCharacterEditEmbed(
    character: Character,
    interaction: ModalSubmitInteraction
  ): Promise<void> {
    try {
      if (!interaction.channel || !('messages' in interaction.channel)) {
        this.logger.warn('Channel does not support message fetching')
        return
      }

      const textChannel = interaction.channel as TextChannel

      // 最近の50メッセージを取得してcharacterEditEmbedを探す
      const messages = await textChannel.messages.fetch({ limit: 50 })
      const characterEditMessage = this.findCharacterEditMessage(messages, character.characterId)

      if (characterEditMessage) {
        // 既存メッセージを更新（更新メッセージなし）
        const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)

        await characterEditMessage.edit({
          embeds,
          components
        })

        this.logger.log(`Updated existing characterEdit embed for character: ${character.characterId}`)
      } else {
        // 既存メッセージが見つからない場合は新規送信（更新メッセージなし）
        this.logger.warn(
          `No existing characterEdit message found for character: ${character.characterId}, sending new message`
        )

        const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)
        await textChannel.send({
          embeds,
          components
        })
      }
    } catch (error) {
      this.logger.error('Failed to update existing characterEdit embed', error)

      // フォールバック: 新しいメッセージを送信（更新メッセージなし）
      try {
        if (interaction.channel && 'send' in interaction.channel) {
          const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)
          await (interaction.channel as TextChannel).send({
            embeds,
            components
          })
        }
      } catch (fallbackError) {
        this.logger.error('Fallback message sending also failed', fallbackError)
      }
    }
  }

  /**
   * CharacterEditメッセージを検索
   */
  private findCharacterEditMessage(messages: Collection<string, Message>, characterId: string): Message | null {
    for (const message of messages.values()) {
      // ボット自身のメッセージのみを対象
      if (!message.author.bot) continue

      // キャラクター編集関連のボタンやセレクトメニューがあるかチェック
      type ComponentLike = { type?: number; customId?: string }
      type ActionRowLike = { components?: ComponentLike[] }
      const actionRows: ActionRowLike[] = (message.components ?? []) as ActionRowLike[]

      const hasCharacterComponents = actionRows.some((row) => {
        const components: ComponentLike[] = row.components ?? []
        return components.some((component) => {
          const customId = component.customId ?? ''
          return (
            // ボタン (type = 2)
            (component.type === 2 &&
              (customId.includes(`character-refresh-${characterId}`) ||
                customId.includes(`character-compact-view-${characterId}`))) ||
            // セレクトメニュー (type = 3)
            (component.type === 3 &&
              (customId.includes(`character-section-select-${characterId}`) ||
                customId.includes(`character-edit-section-${characterId}`) ||
                customId.includes(`character-field-edit-`) ||
                customId.includes(`character-field-add-`)))
          )
        })
      })

      // Embedの内容もチェック（キャラクター名が含まれているか）
      const hasCharacterEmbed = message.embeds.some((embed) => {
        const title = embed.title ?? ''
        const description = embed.description ?? ''
        return title.includes('キャラクター情報') || description.includes('キャラクター')
      })

      if (hasCharacterComponents || hasCharacterEmbed) {
        return message
      }
    }

    return null
  }

  /**
   * セクション編集のEmbedとメニューをクリア
   */
  private async clearSectionEditEmbed(interaction: ModalSubmitInteraction, characterId: string): Promise<void> {
    try {
      if (!interaction.channel || !('messages' in interaction.channel)) {
        this.logger.warn('Channel does not support message fetching for clearing section edit')
        return
      }

      const textChannel = interaction.channel as TextChannel

      // 最近の50メッセージを取得してセクション編集Embedを探す
      const messages = await textChannel.messages.fetch({ limit: 50 })

      for (const message of messages.values()) {
        // ボット自身のメッセージのみを対象
        if (!message.author.bot) continue

        // セクション編集のEmbedかどうかをチェック
        const isSectionEditEmbed = this.isSectionEditEmbed(message, characterId)

        if (isSectionEditEmbed) {
          this.logger.log(`Clearing section edit embed: ${message.id} for character: ${characterId}`)

          // メッセージを削除
          try {
            await message.delete()
            this.logger.debug(`Section edit embed deleted successfully: ${message.id}`)
          } catch (deleteError) {
            // 削除に失敗した場合はコンテンツをクリア
            this.logger.warn(`Failed to delete message, clearing content instead: ${deleteError}`)
            await message.edit({
              content: '✅ 編集が完了しました。',
              embeds: [],
              components: []
            })
          }
          break // 最初に見つかったセクション編集Embedのみを処理
        }
      }
    } catch (error) {
      this.logger.error('Failed to clear section edit embed', error)
    }
  }

  /**
   * メッセージがセクション編集Embedかどうかを判定
   */
  private isSectionEditEmbed(message: Message, characterId: string): boolean {
    // セクション編集のEmbedの特徴をチェック
    // 1. Embedのタイトルに「編集」が含まれる
    // 2. セクション選択メニューまたは戻るメニューがある

    const hasEditTitle = message.embeds.some((embed) => embed.title && embed.title.includes('編集'))

    type ComponentLike = { type?: number; customId?: string }
    type ActionRowLike = { components?: ComponentLike[] }
    const rows = (message.components ?? []) as ActionRowLike[]

    const hasSectionSelectMenu = rows.some((row) => {
      const comps: ComponentLike[] = row.components ?? []
      return comps.some((component: ComponentLike) => {
        if (component.type !== 3) return false // StringSelectMenu type = 3
        const customId = component.customId ?? ''
        return (
          customId.includes(`character-edit-section-${characterId}`) ||
          customId.includes('character-field-edit-') ||
          customId.includes('character-field-add-')
        )
      })
    })

    return hasEditTitle && hasSectionSelectMenu
  }
}
