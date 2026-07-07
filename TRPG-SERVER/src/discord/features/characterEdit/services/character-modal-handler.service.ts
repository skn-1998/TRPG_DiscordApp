/**
 * Character Modal Handler Service
 *
 * キャラクター編集モーダルの送信処理を担当
 * フィールドの追加・更新・削除機能を提供
 */

import { Injectable, Logger } from '@nestjs/common'
import { ModalSubmitInteraction, EmbedBuilder, TextChannel, Message, Collection } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { CharacterInputDto } from '../../../../domains/character/dto/create-character.dto'
import { CharacterService } from '../../../../domains/character/character.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { ErrorHandler } from '../../../../core/http/error-handler'
import { CharacterEmbedManagerService, EmbedSectionType } from './character-embed-manager.service'
import { ModalSessionManagerService } from './modal-session-manager.service'
import {
  FieldData,
  parseEditCustomId,
  parseCreationCustomId,
  buildFieldData,
  buildAttributeValueFromForm,
  isValidAttributeValue,
  getSectionData,
  buildUpdateData
} from './character-modal-handler.util'

// 後方互換: 既存の import 元を維持するため再エクスポート
export type { FieldData } from './character-modal-handler.util'

@Injectable()
export class CharacterModalHandlerService {
  private readonly logger = new Logger(CharacterModalHandlerService.name)

  constructor(
    private readonly characterService: CharacterService,
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
    const { channelId, userId } = parseCreationCustomId(interaction.customId)
    if (!channelId || !userId) {
      await this.sendErrorResponse(interaction, 'チャンネル情報の取得に失敗しました。')
      return
    }

    // キャラクターを作成
    const character = await this.embedManager.createCharacter(characterData, channelId, userId)

    if (character) {
      // 成功メッセージ（本人向け reply のみ）
      const successEmbed = this.embedManager.createCharacterCreatedEmbed(character)
      await interaction.editReply({
        embeds: [successEmbed],
        components: []
      })

      // チャンネルへのセクション Embed 投稿はここでは行わない:
      // createCharacter が発行する character.creation.completed を CharacterCreationCompletedHandler が
      // 購読して送信する（チャンネル名同期・通知も同経路）。ここでも送ると二重投稿になる（E-2f）。
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
      fieldKey, // nullチェック済み
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

    const parsed = parseEditCustomId(customId)

    switch (parsed.kind) {
      case 'session': {
        this.logger.debug(`Using session-based customId with sessionId: ${parsed.sessionId}`)

        // ModalSessionManagerServiceからセッションデータを取得（副作用）
        const sessionData = this.modalSessionManager.getSession(parsed.sessionId)
        if (sessionData) {
          this.logger.debug(`Session found: ${JSON.stringify(sessionData)}`)
          // セッション使用後は削除
          this.modalSessionManager.removeSession(parsed.sessionId)
          return {
            characterId: sessionData.characterId,
            sectionType: sessionData.sectionType,
            fieldKey: sessionData.fieldKey
          }
        }

        this.logger.warn(`Session not found for sessionId: ${parsed.sessionId}`)
        return { characterId: null, sectionType: null, fieldKey: null }
      }

      case 'legacy': {
        this.logger.debug(
          `Legacy parsed: sectionType=${parsed.sectionType}, fieldKey=${parsed.fieldKey}, characterId=${parsed.characterId}`
        )
        return {
          characterId: parsed.characterId,
          sectionType: parsed.sectionType,
          fieldKey: parsed.fieldKey
        }
      }

      default:
        this.logger.warn(`CustomId format not recognized: ${customId}`)
        return { characterId: null, sectionType: null, fieldKey: null }
    }
  }

  /**
   * フォームデータを抽出
   */
  private extractFormData(interaction: ModalSubmitInteraction): FieldData | null {
    try {
      // discord.js I/O: 各フィールドの生値を取得（存在しない場合は例外/空）
      const raw = {
        name: this.readTextInput(interaction, 'field-name'),
        values: this.readTextInput(interaction, 'field-values'),
        dice: this.readTextInput(interaction, 'field-dice'),
        description: this.readTextInput(interaction, 'field-description')
      }

      // 変換・バリデーションは純関数へ委譲
      const fieldData = buildFieldData(raw)
      if (!fieldData) {
        this.logger.warn('No valid data found in form fields - values, dice, and description are all empty')
      }
      return fieldData
    } catch (error) {
      this.logger.error('Failed to extract form data', error)
      return null
    }
  }

  /**
   * モーダルフィールドの生値を読む（I/O 境界）。存在しない場合は undefined。
   */
  private readTextInput(interaction: ModalSubmitInteraction, customId: string): string | undefined {
    try {
      return interaction.fields.getTextInputValue(customId)
    } catch {
      return undefined
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
      // 更新するセクションのデータを取得（純関数）
      const sectionData: Record<string, unknown> = { ...(getSectionData(character, sectionType) ?? {}) }

      this.logger.debug(`Raw form data for ${character.characterId}:`, {
        name: formData.name,
        values: formData.values,
        dice: formData.dice,
        description: formData.description,
        sectionType,
        fieldKey,
        isNewField: fieldKey === 'add_new'
      })

      // AttributeValue を構築（純関数）
      const { actualFieldKey, attributeValue } = buildAttributeValueFromForm(fieldKey, formData, Date.now())

      this.logger.debug(`Creating AttributeValue for ${actualFieldKey}:`, JSON.stringify(attributeValue, null, 2))

      // 値が有効かチェック（純関数）
      if (!isValidAttributeValue(attributeValue)) {
        this.logger.error(`Invalid data for field ${actualFieldKey}: no name or values/description/dice`)
        return false
      }

      // セクションデータを更新
      sectionData[actualFieldKey] = attributeValue

      // 更新DTOを作成（純関数）
      const updateData = buildUpdateData(sectionType, sectionData)
      if (!updateData) {
        return false
      }

      // DI で直接更新（E-2d: update RPC の DI 化）
      const updated = await this.characterService.update(character.characterId, updateData)
      if (!updated) {
        this.logger.error(`Character update failed: ${character.characterId}`)
        return false
      }

      // completed 通知は本サービスから fire-and-forget で継続発行（発行責務の移転）。
      // await しない＝UI 連鎖（CharacterUpdateCompletedHandler 等）の失敗が update の成否に混ざらない。
      void this.typedEventService
        .emit('character.update.completed', {
          channelId: character.discordChannelId || '',
          character: updated,
          source: 'character-modal-handler',
          timestamp: new Date()
        })
        .catch((error) => {
          this.logger.warn(`Failed to emit character.update.completed: ${character.characterId}`, error)
        })

      this.logger.log(
        `Character field updated successfully: ${character.characterId} - ${sectionType}.${actualFieldKey}`
      )
      this.logger.debug(`Updated field value: ${JSON.stringify(attributeValue)}`)
      return true
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
      // DI で直接取得（E-2d: findById RPC の DI 化）
      return await this.characterService.findOne(characterId)
    } catch (error) {
      this.logger.error(`Failed to get character: ${characterId}`, error)
      return null
    }
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
