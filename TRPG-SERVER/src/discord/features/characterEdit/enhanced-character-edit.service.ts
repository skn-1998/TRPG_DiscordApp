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
import { ErrorHandler } from '../../../utils/error-handler'
import { CharacterEmbedManagerService } from './services/character-embed-manager.service'
import { CharacterSectionEditorService } from './services/character-section-editor.service'
import { CharacterModalHandlerService } from './services/character-modal-handler.service'
import { DiscordClientService } from '../../services/discord-client.service'

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
    private readonly modalHandler: CharacterModalHandlerService,
    private readonly discordClientService: DiscordClientService
  ) {}

  /**
   * モジュール初期化
   */
  async onModuleInit(): Promise<void> {
    this.registerEventHandlers()
    this.logger.log('Enhanced Character Edit Service initialized')
  }

  /**
   * イベントハンドラーを登録
   */
  private registerEventHandlers(): void {
    // キャラクター更新完了時のEmbed再表示
    this.typedEventService.on('character.update.completed', this.handleCharacterUpdated.bind(this))

    // Character更新汎用イベント（characterService.updateDiscordEmbedから）
    this.typedEventService.on(
      'discord.embed.character.update.requested',
      this.handleDiscordEmbedUpdateRequested.bind(this)
    )

    this.logger.debug('Enhanced Character Edit event handlers registered')
  }

  /**
   * 改善されたキャラクター編集画面を表示
   */
  async displayEnhancedCharacterEdit(channel: TextChannel, character: Character): Promise<void> {
    try {
      this.logger.log(`Displaying enhanced character edit for: ${character.characterId}`)

      // 分割Embedを送信
      await this.embedManager.sendSectionedEmbeds(channel, character)

      this.logger.log(`Enhanced character edit displayed successfully`)
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          channelId: channel.id,
          characterId: character.characterId
        },
        'EnhancedCharacterEditService'
      )

      // フォールバック: 簡易メッセージ
      await channel.send({
        content: `❌ ${character.characterName}の編集画面の表示に失敗しました。`
      })
    }
  }

  /**
   * チャンネルIDからキャラクター編集画面を表示
   */
  async displayCharacterEditByChannelId(channelId: string): Promise<void> {
    try {
      // キャラクター情報を取得
      const character = await this.getCharacterByChannelId(channelId)
      if (!character) {
        this.logger.warn(`Character not found for channel: ${channelId}`)
        return
      }

      // チャンネル情報を取得
      // この部分はDiscordServiceやTypedEventServiceを使用して実装
      // 簡略化のため、コメントとして記載
      // const channel = await this.getChannelById(channelId)
      // if (channel && channel instanceof TextChannel) {
      //   await this.displayEnhancedCharacterEdit(channel, character)
      // }
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
      }
      // 簡易表示ボタンの処理
      else if (customId.startsWith('character-compact-view-')) {
        await this.handleCompactViewButton(interaction)
      }
    } catch (error) {
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
      // セクションエディターに委譲
      await this.sectionEditor.execute(interaction)
    } catch (error) {
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
      // モーダルハンドラーに委譲
      await this.modalHandler.handleModalSubmit(interaction)
    } catch (error) {
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
   * Discord Embed更新リクエストイベントの処理
   */
  private async handleDiscordEmbedUpdateRequested(
    payload: import('../../../shared/domain/events/event-contracts').EventPayload<'discord.embed.character.update.requested'>
  ): Promise<void> {
    try {
      const { character, channelId, source } = payload

      this.logger.log(
        `Discord embed update requested for character: ${character.characterId}, channel: ${channelId}, source: ${source}`
      )

      // characterEdit embedを更新
      await this.updateCharacterEditEmbed(character, channelId)

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
        return result.character
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
        return result.character
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
   * 新規キャラクター作成画面の表示
   */
  async displayNewCharacterCreation(channel: TextChannel, userId: string): Promise<void> {
    try {
      const { embeds, components } = this.embedManager.createNewCharacterEmbed(channel.id, userId)

      await channel.send({
        embeds,
        components
      })

      this.logger.log(`New character creation displayed for user: ${userId} in channel: ${channel.id}`)
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          channelId: channel.id,
          userId
        },
        'EnhancedCharacterEditService.displayNewCharacterCreation'
      )
      throw error
    }
  }

  /**
   * 指定されたチャンネルのcharacterEdit embedを更新する
   */
  private async updateCharacterEditEmbed(character: Character, channelId: string): Promise<void> {
    try {
      this.logger.log(`Updating character edit embed for channel: ${channelId}, character: ${character.characterId}`)

      // Discord チャンネルを取得
      const discordClient = this.discordClientService.getClient()
      const channel = await discordClient.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(`Channel not found or not text-based: ${channelId}`)
        return
      }

      const textChannel = channel as TextChannel

      // 新しいcharacterEdit embedを作成
      const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)

      // 更新メッセージを送信（新規投稿として）
      await textChannel.send({
        content: `🔄 ${character.characterName}の情報が更新されました`,
        embeds,
        components
      })

      this.logger.log(`Character edit embed updated successfully for channel: ${channelId}`)
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
}
