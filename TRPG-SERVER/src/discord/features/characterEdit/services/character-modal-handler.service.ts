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
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { ErrorHandler } from '../../../../utils/error-handler'
import { CharacterEmbedManagerService, EmbedSectionType } from './character-embed-manager.service'

/**
 * フィールドデータ構造
 */
export interface FieldData {
  name?: string
  value: string
  description?: string
}

@Injectable()
export class CharacterModalHandlerService {
  private readonly logger = new Logger(CharacterModalHandlerService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly embedManager: CharacterEmbedManagerService
  ) {}

  /**
   * モーダル送信の処理
   */
  async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true })

      // キャラクター作成モーダルかどうかを確認
      if (interaction.customId.includes('character-create-basic')) {
        await this.handleCharacterCreation(interaction)
        return
      }

      // 既存のキャラクター編集処理
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
    // カスタムIDを解析
    const { characterId, sectionType, fieldKey } = this.parseModalCustomId(interaction.customId)

    if (!characterId || !sectionType || !fieldKey) {
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
      await this.sendSuccessResponse(interaction, sectionType, formData.name || (fieldKey as string))

      // 既存のcharacterEditEmbedを更新
      await this.updateExistingCharacterEditEmbed(character, interaction)
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
    // 形式: character-edit-modal-{sectionType}-{fieldKey}-{characterId}
    const prefix = 'character-edit-modal-'
    if (!customId.startsWith(prefix)) {
      return { characterId: null, sectionType: null, fieldKey: null }
    }

    const rest = customId.slice(prefix.length)
    const parts = rest.split('-')
    if (parts.length < 3) return { characterId: null, sectionType: null, fieldKey: null }

    const sectionType = parts[0] as EmbedSectionType
    const fieldKey = parts[1]
    const characterId = parts.slice(2).join('-') // 残り全てをcharacterIdとして扱う

    return { characterId, sectionType, fieldKey }
  }

  /**
   * フォームデータを抽出
   */
  private extractFormData(interaction: ModalSubmitInteraction): FieldData | null {
    try {
      const name = interaction.fields.getTextInputValue('field-name') || undefined
      const value = interaction.fields.getTextInputValue('field-value')
      const description = interaction.fields.getTextInputValue('field-description') || undefined

      if (!value || value.trim() === '') {
        return null
      }

      return {
        name: name?.trim(),
        value: value.trim(),
        description: description?.trim()
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

      // フィールドキーを決定（新規の場合はフォームの名前を使用）
      const actualFieldKey = fieldKey === 'add_new' ? formData.name || `new_${Date.now()}` : fieldKey

      // フィールドデータを構築
      type FieldStructured = { name?: string; value: string; description?: string }
      let fieldValue: string | FieldStructured
      if (formData.description) {
        fieldValue = {
          name: formData.name || actualFieldKey,
          value: formData.value,
          description: formData.description
        }
      } else if (formData.name && formData.name !== actualFieldKey) {
        fieldValue = {
          name: formData.name,
          value: formData.value
        }
      } else {
        fieldValue = formData.value
      }

      // セクションデータを更新
      sectionData[actualFieldKey] = fieldValue

      // 更新DTOを作成
      let updateData: UpdateCharacterDto

      switch (sectionType) {
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
        channelId: character.discordChannelId || '',
        updateData,
        userId: character.discordUserId,
        source: 'character-modal-handler',
        timestamp: new Date()
      })

      // 更新完了を待機
      const result = await resultPromise

      if ('character' in result) {
        this.logger.log(`Character field updated: ${character.characterId} - ${sectionType}.${actualFieldKey}`)
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
   * 成功レスポンスを送信
   */
  private async sendSuccessResponse(
    interaction: ModalSubmitInteraction,
    sectionType: EmbedSectionType,
    fieldName: string
  ): Promise<void> {
    const sectionNames = {
      status: 'ステータス',
      parameter: 'パラメータ',
      skill: 'スキル',
      item: 'アイテム',
      basic: '基本情報'
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ 更新完了')
      .setDescription(`${sectionNames[sectionType]}「${fieldName}」を更新しました。`)
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
        // 既存メッセージを更新
        const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)

        await characterEditMessage.edit({
          content: `✅ ${character.characterName}の情報を更新しました`,
          embeds,
          components
        })

        this.logger.log(`Updated existing characterEdit embed for character: ${character.characterId}`)
      } else {
        // 既存メッセージが見つからない場合は新規送信
        this.logger.warn(
          `No existing characterEdit message found for character: ${character.characterId}, sending new message`
        )

        const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)
        await textChannel.send({
          content: `✅ ${character.characterName}の情報を更新しました`,
          embeds,
          components
        })
      }
    } catch (error) {
      this.logger.error('Failed to update existing characterEdit embed', error)

      // フォールバック: 新しいメッセージを送信
      try {
        if (interaction.channel && 'send' in interaction.channel) {
          const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)
          await (interaction.channel as TextChannel).send({
            content: `✅ ${character.characterName}の情報を更新しました`,
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

      // 更新ボタンまたは簡易表示ボタンがあるかチェック
      const hasCharacterEditButtons = message.components.some(
        (row: any) =>
          row.components &&
          row.components.some((component: any) => {
            if (component.type !== 2) return false // Button type = 2
            const customId = component.customId
            return (
              customId &&
              (customId.includes(`character-refresh-${characterId}`) ||
                customId.includes(`character-compact-view-${characterId}`))
            )
          })
      )

      if (hasCharacterEditButtons) {
        return message
      }
    }

    return null
  }
}
