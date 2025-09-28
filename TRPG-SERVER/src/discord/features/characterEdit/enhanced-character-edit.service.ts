/**
 * Enhanced Character Edit Service
 *
 * 改善されたキャラクター編集機能の統合サービス
 * 分割Embed表示とセレクトメニューでの編集機能を提供
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  TextChannel,
  ThreadChannel,
  CacheType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  Message,
  Collection
} from 'discord.js'
import { Character } from '../../../domains/character/models/character.model'
import { TypedEventService } from '../../../shared/application/typed-event.service'
import { EventPayload } from '../../../events/contracts'
import { ErrorHandler } from '../../../utils/error-handler'
import { AttributeValue } from '../../../core/types/attribute.types'
import { CharacterEmbedManagerService } from './services/character-embed-manager.service'
import { CharacterSectionEditorService } from './services/character-section-editor.service'
import { CharacterModalHandlerService } from './services/character-modal-handler.service'
// DiscordClientService依存を完全削除 - イベント駆動アーキテクチャに移行

/**
 * 統合キャラクター編集サービス
 *
 * 全ての編集機能を統合し、一元的なインターフェースを提供
 */
@Injectable()
export class EnhancedCharacterEditService implements OnModuleInit {
  private readonly logger = new Logger(EnhancedCharacterEditService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly embedManager: CharacterEmbedManagerService,
    private readonly sectionEditor: CharacterSectionEditorService,
    private readonly modalHandler: CharacterModalHandlerService
    // DiscordClientService依存を完全削除 - 全てイベント駆動に移行
  ) {}

  /**
   * モジュール初期化
   */
  async onModuleInit(): Promise<void> {
    // イベントハンドラー登録は削除 - EventRouterServiceで一元管理
    this.logger.log('Enhanced Character Edit Service initialized')
  }

  /**
   * 改善されたキャラクター編集画面を表示（イベント駆動）
   */
  async displayEnhancedCharacterEdit(channelId: string, character: Character): Promise<void> {
    try {
      this.logger.log(`Requesting enhanced character edit display for: ${character.characterId}`)

      // Discord Message送信リクエストイベント発行
      const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)

      await this.typedEventService.emit('discord.message.send.requested', {
        channelId,
        content: '',
        embeds,
        source: 'enhanced-character-edit',
        timestamp: new Date()
      })

      this.logger.log(`Enhanced character edit display requested successfully`)
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          characterId: character.characterId
        },
        'EnhancedCharacterEditService'
      )

      // フォールバック: エラーメッセージ送信
      await this.typedEventService.emit('discord.message.send.requested', {
        channelId,
        content: `❌ ${character.characterName}の編集画面の表示に失敗しました。`,
        source: 'enhanced-character-edit',
        timestamp: new Date()
      })
    }
  }

  /**
   * チャンネルIDからキャラクター編集画面を表示（イベント駆動）
   */
  async displayCharacterEditByChannelId(channelId: string): Promise<void> {
    try {
      // キャラクター情報を取得
      const character = await this.getCharacterByChannelId(channelId)
      if (!character) {
        this.logger.warn(`Character not found for channel: ${channelId}`)
        return
      }

      // イベント駆動でキャラクター編集画面を表示
      await this.displayEnhancedCharacterEdit(channelId, character)
    } catch (error) {
      ErrorHandler.handleServiceError(error, { channelId }, 'EnhancedCharacterEditService')
    }
  }

  /**
   * ボタンインタラクションの処理
   */
  async handleButtonInteraction(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      const customId = interaction.customId

      // キャラクター作成基本情報ボタン
      if (customId.startsWith('character-create-basic-')) {
        await this.handleCreateBasicButton(interaction)
      }
      // キャラクター作成キャンセルボタン
      else if (customId.startsWith('character-create-cancel-')) {
        await this.handleCreateCancelButton(interaction)
      }
      // 更新ボタンの処理
      else if (customId.startsWith('character-refresh-')) {
        await this.handleRefreshButton(interaction)

        // Embed更新リクエストイベント発火
        await this.emitEmbedRefreshEvent(interaction)
      }
      // 簡易表示ボタンの処理
      else if (customId.startsWith('character-compact-view-')) {
        await this.handleCompactViewButton(interaction)
      }
    } catch (error) {
      // エラーイベント発火
      await this.emitErrorEvent(error, interaction.customId, interaction.user.id)

      ErrorHandler.handleServiceError(
        error,
        {
          customId: interaction.customId,
          userId: interaction.user.id
        },
        'EnhancedCharacterEditService'
      )
    }
  }

  /**
   * セレクトメニューインタラクションの処理
   */
  async handleSelectMenuInteraction(interaction: StringSelectMenuInteraction<CacheType>): Promise<void> {
    try {
      // セクション選択イベント発火
      await this.emitSectionSelectedEvent(interaction)

      // セクションエディターに委譲
      await this.sectionEditor.execute(interaction)
    } catch (error) {
      // エラーイベント発火
      await this.emitErrorEvent(error, interaction.customId, interaction.user.id)

      ErrorHandler.handleServiceError(
        error,
        {
          customId: interaction.customId,
          userId: interaction.user.id
        },
        'EnhancedCharacterEditService'
      )
    }
  }

  /**
   * モーダル送信インタラクションの処理
   */
  async handleModalSubmitInteraction(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    try {
      // モーダル送信イベント発火
      await this.emitModalSubmittedEvent(interaction)

      // モーダルハンドラーに委譲
      await this.modalHandler.handleModalSubmit(interaction)
    } catch (error) {
      // エラーイベント発火
      await this.emitErrorEvent(error, interaction.customId, interaction.user.id)

      ErrorHandler.handleServiceError(
        error,
        {
          customId: interaction.customId,
          userId: interaction.user.id
        },
        'EnhancedCharacterEditService'
      )
    }
  }

  /**
   * 更新ボタンの処理
   */
  private async handleRefreshButton(interaction: ButtonInteraction<CacheType>): Promise<void> {
    await interaction.deferUpdate()

    // キャラクターIDを抽出
    const characterId = this.extractCharacterIdFromCustomId(interaction.customId)
    if (!characterId) {
      await interaction.followUp({
        content: '❌ キャラクター情報の取得に失敗しました。',
        ephemeral: true
      })
      return
    }

    // キャラクター情報を取得
    const character = await this.getCharacterById(characterId)
    if (!character) {
      await interaction.followUp({
        content: '❌ キャラクターが見つかりません。',
        ephemeral: true
      })
      return
    }

    // 既存のcharacterEditEmbedを更新
    await this.updateExistingCharacterEditEmbed(character, interaction)
  }

  /**
   * 簡易表示ボタンの処理
   */
  private async handleCompactViewButton(interaction: ButtonInteraction<CacheType>): Promise<void> {
    await interaction.deferReply({ ephemeral: true })

    // キャラクターIDを抽出
    const characterId = this.extractCharacterIdFromCustomId(interaction.customId)
    if (!characterId) {
      await interaction.editReply({
        content: '❌ キャラクター情報の取得に失敗しました。'
      })
      return
    }

    // 簡易表示のEmbedを作成（既存のCharacterDisplayServiceを利用）
    // この部分は既存のサービスを活用
    await interaction.editReply({
      content: '📋 簡易表示機能は開発中です。'
    })
  }

  /**
   * キャラクター更新イベントの処理
   */
  private async handleCharacterUpdated(payload: any): Promise<void> {
    try {
      const { character, channelId } = payload

      this.logger.log(`Character updated, refreshing embeds: ${character.characterId}`)

      // 指定されたchannelIdでcharacterEdit embedを自動更新
      if (channelId) {
        await this.updateCharacterEditEmbed(character, channelId)
      }
    } catch (error) {
      this.logger.error('Failed to handle character updated event', error)
    }
  }

  /**
   * キャラクター自動更新イベントの処理（character-edit専用）
   */
  private async handleCharacterAutoUpdate(payload: EventPayload<'character.updated'>): Promise<void> {
    const { character, updateType } = payload

    this.logger.log(`[CHARACTER-EDIT] Character updated: ${character.characterId} (${updateType})`)

    try {
      // character-editが管理するチャンネルのEmbedのみ更新
      if (character.discordChannelId && this.isCharacterEditChannel(character.discordChannelId)) {
        await this.updateCharacterEditEmbed(character, character.discordChannelId)
        this.logger.log(`[CHARACTER-EDIT] Auto-update completed for ${character.characterId}`)
      }
    } catch (error) {
      this.logger.error(`[CHARACTER-EDIT] Auto-update failed for ${character.characterId}`, error)
    }
  }

  /**
   * チャンネルがcharacter-edit管理下かどうかを判定
   */
  private isCharacterEditChannel(channelId: string): boolean {
    // この実装は要件に応じて調整
    // 例: character-editが作成したチャンネル、特定のチャンネル名パターンなど
    return true // 暫定的にすべてのチャンネルを対象とする
  }

  /**
   * Discord Embed更新リクエストイベントの処理
   */
  async handleDiscordEmbedUpdateRequested(
    payload: EventPayload<'discord.embed.character.update.requested'>
  ): Promise<void> {
    try {
      const { character, channelId, displayType, source } = payload

      this.logger.log(
        `Discord embed update requested for character: ${character.characterId}, channel: ${channelId}, displayType: ${displayType}, source: ${source}`
      )

      // displayTypeが'enhanced'の場合のみ処理
      if (displayType === 'enhanced') {
        await this.updateCharacterEditEmbed(character, channelId)
      } else {
        this.logger.log(`Skipping enhanced display for displayType: ${displayType}`)
        return
      }

      // 成功イベントを発行
      await this.typedEventService.emit('discord.embed.character.update.completed', {
        characterId: character.characterId,
        channelId,
        success: true,
        source: 'enhanced-character-edit',
        timestamp: new Date()
      })
    } catch (error) {
      this.logger.error('Failed to handle discord embed update requested event', error)

      // 失敗イベントを発行
      await this.typedEventService.emit('discord.embed.character.update.failed', {
        characterId: payload.character.characterId,
        channelId: payload.channelId,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'enhanced-character-edit',
        timestamp: new Date()
      })
    }
  }

  /**
   * キャラクター表示リクエストイベントの処理
   */
  async handleCharacterDisplayRequested(payload: EventPayload<'discord.character.display.requested'>): Promise<void> {
    try {
      const { character, channelId, displayType, source } = payload

      this.logger.log(
        `[CHARACTER-EDIT] Display requested: ${character.characterId}, channel: ${channelId}, displayType: ${displayType}, source: ${source}`
      )

      // character-edit専用: enhanced表示のみ処理
      if (displayType === 'enhanced' && this.isCharacterEditChannel(channelId)) {
        this.logger.log(`[CHARACTER-EDIT] Processing enhanced display for ${character.characterId}`)

        // イベント駆動でEnhanced表示を実行
        await this.displayEnhancedCharacterEdit(channelId, character)

        this.logger.log(`[CHARACTER-EDIT] Enhanced display completed for ${character.characterId}`)
      } else {
        this.logger.log(`[CHARACTER-EDIT] Skipping - displayType: ${displayType}, channel: ${channelId}`)
      }
    } catch (error) {
      this.logger.error(`[CHARACTER-EDIT] Display request failed for ${payload.character.characterId}`, error)
    }
  }

  /**
   * チャンネルIDでキャラクターを取得
   */
  private async getCharacterByChannelId(channelId: string): Promise<Character | null> {
    try {
      // waitForEventを先に設定してからemitする
      const resultPromise = Promise.race([
        this.typedEventService.waitForEvent('character.findByChannelId.completed', 5000),
        this.typedEventService.waitForEvent('character.findByChannelId.failed', 5000)
      ])

      await this.typedEventService.emit('character.findByChannelId.requested', {
        channelId,
        source: 'enhanced-character-edit',
        timestamp: new Date()
      })

      const result = await resultPromise

      if ('character' in result && result.character) {
        // Character.EntityをCharacter型にキャスト（型定義統一まで一時的対応）
        return result.character as any as Character
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to get character by channel ID: ${channelId}`, error)
      return null
    }
  }

  /**
   * キャラクターIDでキャラクターを取得
   */
  private async getCharacterById(characterId: string): Promise<Character | null> {
    try {
      // waitForEventを先に設定してからemitする
      const resultPromise = Promise.race([
        this.typedEventService.waitForEvent('character.findById.completed', 5000),
        this.typedEventService.waitForEvent('character.findById.failed', 5000)
      ])

      await this.typedEventService.emit('character.findById.requested', {
        characterId,
        source: 'enhanced-character-edit',
        timestamp: new Date()
      })

      const result = await resultPromise

      if ('character' in result && result.character) {
        // Character.EntityをCharacter型にキャスト（型定義統一まで一時的対応）
        return result.character as any as Character
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to get character by ID: ${characterId}`, error)
      return null
    }
  }

  /**
   * カスタムIDからキャラクターIDを抽出
   */
  private extractCharacterIdFromCustomId(customId: string): string | null {
    const patterns = [/character-refresh-(.+)/, /character-compact-view-(.+)/]

    for (const pattern of patterns) {
      const match = customId.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }

    return null
  }

  /**
   * キャラクター作成基本情報ボタンの処理
   */
  private async handleCreateBasicButton(interaction: ButtonInteraction<CacheType>): Promise<void> {
    // キャラクター作成用モーダルを表示
    const modal = new ModalBuilder()
      .setCustomId(interaction.customId) // 元のカスタムIDを再利用
      .setTitle('🆕 新しいキャラクター作成')

    const characterNameInput = new TextInputBuilder()
      .setCustomId('character-name')
      .setLabel('キャラクター名')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('キャラクターの名前を入力してください')
      .setRequired(true)
      .setMaxLength(100)

    const gameSystemInput = new TextInputBuilder()
      .setCustomId('game-system')
      .setLabel('ゲームシステム')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('例: CoC, D&D, Pathfinder等')
      .setRequired(false)
      .setMaxLength(50)

    const nameRow = new ActionRowBuilder<TextInputBuilder>().addComponents(characterNameInput)
    const systemRow = new ActionRowBuilder<TextInputBuilder>().addComponents(gameSystemInput)

    modal.addComponents(nameRow, systemRow)

    // モーダル開始イベント発火
    await this.emitModalOpenedEvent(interaction)

    await interaction.showModal(modal)
  }

  /**
   * キャラクター作成キャンセルボタンの処理
   */
  private async handleCreateCancelButton(interaction: ButtonInteraction<CacheType>): Promise<void> {
    await interaction.update({
      content: '❌ キャラクター作成がキャンセルされました。',
      embeds: [],
      components: []
    })
  }

  /**
   * 新規キャラクター作成画面の表示（イベント駆動）
   */
  async displayNewCharacterCreation(channelId: string, userId: string): Promise<void> {
    try {
      const { embeds, components } = this.embedManager.createNewCharacterEmbed(channelId, userId)

      // イベント駆動でメッセージを送信
      await this.typedEventService.emit('discord.message.send.requested', {
        channelId,
        content: '',
        embeds,
        source: 'enhanced-character-edit-creation',
        timestamp: new Date()
      })

      this.logger.log(`New character creation display requested for user: ${userId} in channel: ${channelId}`)
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          userId
        },
        'EnhancedCharacterEditService.displayNewCharacterCreation'
      )
      throw error
    }
  }

  /**
   * 指定されたチャンネルのcharacterEdit embedを更新する（イベント駆動）
   */
  private async updateCharacterEditEmbed(character: Character, channelId: string): Promise<void> {
    try {
      this.logger.log(`Updating character edit embed for channel: ${channelId}, character: ${character.characterId}`)

      // 新しいcharacterEdit embedを作成
      const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)

      // イベント駆動で更新メッセージを送信
      await this.typedEventService.emit('discord.message.send.requested', {
        channelId,
        content: `🔄 ${character.characterName}の情報が更新されました`,
        embeds,
        source: 'enhanced-character-edit-update',
        timestamp: new Date()
      })

      this.logger.log(`Character edit embed update requested for channel: ${channelId}`)
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          characterId: character.characterId
        },
        'EnhancedCharacterEditService.updateCharacterEditEmbed'
      )
      throw error
    }
  }

  /**
   * 既存のcharacterEditEmbedを更新（refresh button用）
   */
  private async updateExistingCharacterEditEmbed(
    character: Character,
    interaction: ButtonInteraction<CacheType>
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
          content: `🔄 ${character.characterName}の情報を更新しました`,
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
          content: `🔄 ${character.characterName}の情報を更新しました`,
          embeds,
          components
        })
      }
    } catch (error) {
      this.logger.error('Failed to update existing characterEdit embed', error)
      ErrorHandler.handleServiceError(
        error,
        {
          characterId: character.characterId,
          userId: interaction.user.id
        },
        'EnhancedCharacterEditService.updateExistingCharacterEditEmbed'
      )

      // フォールバック: 新しいメッセージを送信
      try {
        if (interaction.channel && 'send' in interaction.channel) {
          const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)
          await (interaction.channel as TextChannel).send({
            content: `🔄 ${character.characterName}の情報を更新しました`,
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

  // ============================================================================
  // CharacterEdit Event Emission Methods
  // ============================================================================

  /**
   * モーダル開始イベント発火
   */
  private async emitModalOpenedEvent(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      const characterId = this.extractCharacterIdFromCustomId(interaction.customId)
      if (!characterId) return

      await this.typedEventService.emit('characterEdit.modal.opened', {
        characterId,
        userId: interaction.user.id,
        timestamp: new Date(),
        sessionId: `modal-${Date.now()}`,
        modal: {
          sectionType: 'basic' as const,
          fieldKey: 'characterName',
          currentValue: { name: '', values: {}, isVisible: true } as AttributeValue
        }
      })
    } catch (error) {
      this.logger.error('Failed to emit modal opened event', error)
    }
  }

  /**
   * モーダル送信イベント発火
   */
  private async emitModalSubmittedEvent(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    try {
      // CustomIDからキャラクターIDとセクション情報を抽出
      const parts = interaction.customId.split('-')
      const characterId = parts[parts.length - 1] // 最後の部分をcharacterIDとする
      const sectionType = parts[2] || 'unknown'
      const fieldKey = parts[3] || 'unknown'

      // モーダルから新しい値を取得
      const newValue =
        interaction.fields.getTextInputValue(`${sectionType}-${fieldKey}`) ||
        interaction.fields.getTextInputValue('character-name') ||
        interaction.fields.getTextInputValue('game-system') ||
        ''

      await this.typedEventService.emit('characterEdit.modal.submitted', {
        characterId,
        userId: interaction.user.id,
        timestamp: new Date(),
        sessionId: `modal-${Date.now()}`,
        modal: {
          sectionType: (sectionType as 'status' | 'parameter' | 'skill' | 'item' | 'basic') || 'basic',
          fieldKey,
          newValue: { name: newValue, values: {}, isVisible: true } as AttributeValue,
          oldValue: { name: '', values: {}, isVisible: true } as AttributeValue
        }
      })
    } catch (error) {
      this.logger.error('Failed to emit modal submitted event', error)
    }
  }

  /**
   * セクション選択イベント発火
   */
  private async emitSectionSelectedEvent(interaction: StringSelectMenuInteraction<CacheType>): Promise<void> {
    try {
      const characterId = this.extractCharacterIdFromCustomId(interaction.customId)
      if (!characterId) return

      const selectedValue = interaction.values[0]
      const [sectionType, fieldKey] = selectedValue?.split('-') || ['unknown', 'unknown']

      await this.typedEventService.emit('characterEdit.section.selected', {
        characterId,
        userId: interaction.user.id,
        timestamp: new Date(),
        sessionId: `section-${Date.now()}`,
        section: {
          sectionType: (sectionType as 'status' | 'parameter' | 'skill' | 'item' | 'basic') || 'basic',
          displayMode: 'edit' as const
        }
      })

      // フィールド選択イベントも同時発火
      if (fieldKey && fieldKey !== 'unknown') {
        await this.typedEventService.emit('characterEdit.field.selected', {
          characterId,
          userId: interaction.user.id,
          timestamp: new Date(),
          sessionId: `field-${Date.now()}`,
          field: {
            sectionType: (sectionType as 'status' | 'parameter' | 'skill' | 'item' | 'basic') || 'basic',
            fieldKey,
            action: 'edit' as const
          }
        })
      }
    } catch (error) {
      this.logger.error('Failed to emit section selected event', error)
    }
  }

  /**
   * Embed更新リクエストイベント発火
   */
  private async emitEmbedRefreshEvent(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      const characterId = this.extractCharacterIdFromCustomId(interaction.customId)
      if (!characterId) return

      await this.typedEventService.emit('characterEdit.embed.refresh.requested', {
        characterId,
        userId: interaction.user.id,
        timestamp: new Date(),
        sessionId: `embed-${Date.now()}`,
        embed: {
          channelId: interaction.channelId || '',
          embedType: 'enhanced' as const,
          section: 'status' as const
        }
      })
    } catch (error) {
      this.logger.error('Failed to emit embed refresh event', error)
    }
  }

  /**
   * エラーイベント発火
   */
  private async emitErrorEvent(error: any, customId: string, userId: string): Promise<void> {
    try {
      const characterId = this.extractCharacterIdFromCustomId(customId)

      await this.typedEventService.emit('characterEdit.error.occurred', {
        characterId: characterId || 'unknown',
        userId,
        timestamp: new Date(),
        error: {
          code: 'ENHANCED_CHARACTER_EDIT_ERROR',
          message: error.message || 'Unknown error',
          operation: customId,
          details: { customId, stack: error.stack },
          severity: 'medium'
        }
      })
    } catch (emitError) {
      this.logger.error('Failed to emit error event', emitError)
    }
  }
}
