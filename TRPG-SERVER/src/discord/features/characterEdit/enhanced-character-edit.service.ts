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
import { CharacterEntity } from '../../../domains/character/models/character.entity'
import { CharacterService } from '../../../domains/character/character.service'
import { ErrorHandler } from '../../../core/http/error-handler'
import { CharacterSectionEditorService } from './services/character-section-editor.service'
import { CharacterModalHandlerService } from './services/character-modal-handler.service'
import { CharacterEditEventEmitterService } from './services/character-edit-event-emitter.service'
import { CharacterEditMessageUpdaterService } from './services/character-edit-message-updater.service'
import { extractCharacterIdFromCustomId } from './utils/enhanced-character-edit.util'
import { CharacterCreateCustomId } from './custom-id'
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

  async handleRefresh(interaction: ButtonInteraction<CacheType>): Promise<void> {
    await this.executeButtonAction(interaction, async () => {
      await this.handleRefreshButton(interaction)
      await this.eventEmitter.emitEmbedRefresh(interaction)
    })
  }

  async handleCreate(interaction: ButtonInteraction<CacheType>): Promise<void> {
    await this.executeButtonAction(interaction, async () => {
      if (CharacterCreateCustomId.isBasic(interaction.customId)) {
        await this.handleCreateBasicButton(interaction)
      } else if (CharacterCreateCustomId.isCancel(interaction.customId)) {
        await this.handleCreateCancelButton(interaction)
      } else {
        // Invariant: Registry pattern は上記2述語の和集合。この枝は契約 drift 時の silent no-op を防ぐ。
        this.logger.warn(`Unsupported character create customId: ${interaction.customId}`)
        await interaction.reply({
          content: '⚠️ このインタラクションは現在処理できません。',
          flags: MessageFlags.Ephemeral
        })
      }
    })
  }

  async handleCompact(interaction: ButtonInteraction<CacheType>): Promise<void> {
    await this.executeButtonAction(interaction, async () => {
      await this.handleCompactViewButton(interaction)
    })
  }

  private async executeButtonAction(
    interaction: ButtonInteraction<CacheType>,
    action: () => Promise<void>
  ): Promise<void> {
    try {
      await action()
    } catch (error) {
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
    try {
      await this.messageUpdater.updateExistingCharacterEditEmbed(character, interaction)
    } catch (error) {
      try {
        await interaction.followUp({
          content: 'エラーが発生しました。もう一度お試しください。',
          flags: MessageFlags.Ephemeral
        })
      } catch (notificationError) {
        this.logger.warn('Failed to send final character refresh error response', notificationError)
      }
      throw error
    }
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
   * キャラクターIDでキャラクターを取得
   */
  private async getCharacterById(characterId: string): Promise<CharacterEntity | null> {
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
