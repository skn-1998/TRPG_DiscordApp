/**
 * Enhanced Character Edit Service
 *
 * 改善されたキャラクター編集機能の統合サービス
 * 分割Embed表示とセレクトメニューでの編集機能を提供
 *
 * 本サービスは薄いオーケストレーターであり、責務は以下の協力者へ委譲する:
 * - CharacterEmbedManagerService: embed 生成
 * - CharacterSectionEditorService: セクション編集
 * - CharacterModalHandlerService: モーダル送信処理
 * - CharacterEditEventEmitterService: characterEdit.* イベント発行
 * - CharacterEditMessageUpdaterService: 既存メッセージの探索・更新
 * - enhanced-character-edit.util: customId 解析等の純粋ロジック
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  CacheType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags
} from 'discord.js'
import { Character } from '../../../domains/character/models/character.model'
import { CharacterService } from '../../../domains/character/character.service'
import { EventPayload } from '../../../events/contracts'
import { ErrorHandler } from '../../../core/http/error-handler'
import { CharacterEmbedManagerService } from './services/character-embed-manager.service'
import { CharacterSectionEditorService } from './services/character-section-editor.service'
import { CharacterModalHandlerService } from './services/character-modal-handler.service'
import { CharacterEditEventEmitterService } from './services/character-edit-event-emitter.service'
import { CharacterEditMessageUpdaterService } from './services/character-edit-message-updater.service'
import { extractCharacterIdFromCustomId } from './utils/enhanced-character-edit.util'
// P1-D slice1: ボタン分岐判定を feature-local 契約モジュールの述語へ集約（startsWith 等価・挙動不変）
import { CharacterCreateCustomId, CharacterRefreshCustomId, CharacterCompactCustomId } from './custom-id'
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
    private readonly characterService: CharacterService,
    private readonly embedManager: CharacterEmbedManagerService,
    private readonly sectionEditor: CharacterSectionEditorService,
    private readonly modalHandler: CharacterModalHandlerService,
    private readonly eventEmitter: CharacterEditEventEmitterService,
    private readonly messageUpdater: CharacterEditMessageUpdaterService
    // DiscordClientService依存を完全削除 - 全てイベント駆動に移行
  ) {}

  /**
   * モジュール初期化
   */
  async onModuleInit(): Promise<void> {
    // イベントハンドラー登録は削除 - File-based handlers（EventRegistryService）で一元管理
    this.logger.log('Enhanced Character Edit Service initialized')
  }

  /**
   * 改善されたキャラクター編集画面を表示
   *
   * E-3d: dead なメッセージ送信リクエスト emit（恒常購読者ゼロ）を撤去済み。embed 構築のみ行い送信しないゴースト（連鎖解体は E-5/E-6）。
   */
  async displayEnhancedCharacterEdit(channelId: string, character: Character): Promise<void> {
    try {
      this.logger.log(`Requesting enhanced character edit display for: ${character.characterId}`)

      await this.embedManager.createSectionedEmbeds(character)

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
      if (CharacterCreateCustomId.isBasic(customId)) {
        await this.handleCreateBasicButton(interaction)
      }
      // キャラクター作成キャンセルボタン
      else if (CharacterCreateCustomId.isCancel(customId)) {
        await this.handleCreateCancelButton(interaction)
      }
      // 更新ボタンの処理
      else if (CharacterRefreshCustomId.is(customId)) {
        await this.handleRefreshButton(interaction)

        // Embed更新リクエストイベント発火
        await this.eventEmitter.emitEmbedRefresh(interaction)
      }
      // 簡易表示ボタンの処理
      else if (CharacterCompactCustomId.is(customId)) {
        await this.handleCompactViewButton(interaction)
      }
    } catch (error) {
      // エラーイベント発火
      await this.eventEmitter.emitError(error, interaction.customId, interaction.user.id)

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
      // エラーイベント発火
      await this.eventEmitter.emitError(error, interaction.customId, interaction.user.id)

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
      await this.eventEmitter.emitModalSubmitted(interaction)

      // モーダルハンドラーに委譲
      await this.modalHandler.handleModalSubmit(interaction)
    } catch (error) {
      // エラーイベント発火
      await this.eventEmitter.emitError(error, interaction.customId, interaction.user.id)

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
    const characterId = extractCharacterIdFromCustomId(interaction.customId)
    if (!characterId) {
      await interaction.followUp({
        content: '❌ キャラクター情報の取得に失敗しました。',
        flags: MessageFlags.Ephemeral
      })
      return
    }

    // キャラクター情報を取得
    const character = await this.getCharacterById(characterId)
    if (!character) {
      await interaction.followUp({
        content: '❌ キャラクターが見つかりません。',
        flags: MessageFlags.Ephemeral
      })
      return
    }

    // 既存のcharacterEditEmbedを更新
    await this.messageUpdater.updateExistingCharacterEditEmbed(character, interaction)
  }

  /**
   * 簡易表示ボタンの処理
   */
  private async handleCompactViewButton(interaction: ButtonInteraction<CacheType>): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    // キャラクターIDを抽出
    const characterId = extractCharacterIdFromCustomId(interaction.customId)
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
   * 新規キャラクター作成画面の表示
   *
   * E-3d: dead なメッセージ送信リクエスト emit（恒常購読者ゼロ）を撤去済み。embed 構築のみ行い送信しないゴースト（連鎖解体は E-5/E-6）。
   */
  async displayNewCharacterCreation(channelId: string, userId: string): Promise<void> {
    try {
      this.embedManager.createNewCharacterEmbed(channelId, userId)

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
   * チャンネルがcharacter-edit管理下かどうかを判定
   */
  private isCharacterEditChannel(_channelId: string): boolean {
    // この実装は要件に応じて調整
    // 例: character-editが作成したチャンネル、特定のチャンネル名パターンなど
    return true // 暫定的にすべてのチャンネルを対象とする
  }

  /**
   * チャンネルIDでキャラクターを取得
   */
  private async getCharacterByChannelId(channelId: string): Promise<Character | null> {
    try {
      // 同一プロセス内クエリのため CharacterService を直接呼び出す（E-2c: イベント RPC 廃止）
      return await this.characterService.findByChannelId(channelId)
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
      // 同一プロセス内クエリのため CharacterService を直接呼び出す（E-2c: イベント RPC 廃止）
      return await this.characterService.findOne(characterId)
    } catch (error) {
      this.logger.error(`Failed to get character by ID: ${characterId}`, error)
      return null
    }
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
    await this.eventEmitter.emitModalOpened(interaction)

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
}
