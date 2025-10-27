import { Controller, Logger, Inject, forwardRef } from '@nestjs/common'
import { DiceButtonService } from '../features/diceRoll/adapters/dice-button.adapter'
import {
  Client,
  Events,
  ButtonInteraction,
  ModalSubmitInteraction,
  NonThreadGuildBasedChannel,
  ChannelType,
  AnySelectMenuInteraction,
  TextChannel
} from 'discord.js'
import { CharacterChannelService } from '../features/characterThread/character-channel.service'
import { characterEditIds } from '../features/characterEdit/events/character-edit.ids'
import type { eventSelectButtonType, eventType } from './interactions.list'
import { characterThreadIds } from '../features/characterThread/events/character-thread.ids'
import { discordInteractionType } from '../discord.type'
import { isUndefined } from 'lodash'
import { TypedEventEmitter } from 'src/shared/application/typed-event.service'
import { AppConfigService } from 'src/config/config.service'
import { CharacterTabButtonsService } from '../features/characterThread/character-tab-buttons.service'
import { CharacterDiceButtonsService } from './button/character-dice-buttons.service'
import { DiceRollChannelCreateService } from './channel/diceroll-channel-create.service'
import { CharacterChannelCreateService } from './channel/character-channel-create.service'
import { DicePagePrevButtonService } from '../features/diceRoll/adapters/dice-page-prev-button.adapter'
import { DicePageNextButtonService } from '../features/diceRoll/adapters/dice-page-next-button.adapter'
import { DicePageFirstButtonService } from '../features/diceRoll/adapters/dice-page-first-button.adapter'
import { DicePageLastButtonService } from '../features/diceRoll/adapters/dice-page-last-button.adapter'
import { DicePageCancelButtonService } from '../features/diceRoll/adapters/dice-page-cancel-button.adapter'
import { DiceCharacterSelectService } from '../features/diceRoll/adapters/dice-character-select.adapter'
import { CharacterThreadSelectService } from './select/character-thread-select.service'
import { DicePageSelectMenuService } from '../features/diceRoll/adapters/dice-page-select-menu.adapter'
import { ChannelCreateOrchestratorService } from '../features/characterEdit/services/channel-create-orchestrator.service'
import { EnhancedCharacterEditService } from '../features/characterEdit/enhanced-character-edit.service'
import { CustomDiceModalService } from './modal/custom-dice-modal.service'

// システムインタラクションハンドラーの型定義
export type systemInteractionHandlerType = {
  execute: (channel: TextChannel, config: string) => void | Promise<void>
}

/**
 * Discord Interactions Controller
 *
 * 目的: Discord.js インタラクション処理の統合管理
 * 責務: ボタン、モーダル、セレクトメニューのインタラクション処理
 *
 * 注意: Global Events (/events) とは責務が異なります
 * - Global Events: アプリケーション全体のイベント統合
 * - Discord Interactions: Discord.js固有のユーザーインタラクション処理
 */
@Controller('interactions')
export class InteractionsController {
  private readonly logger = new Logger(InteractionsController.name)

  constructor(
    private diceButtonService: DiceButtonService,
    private characterChannelService: CharacterChannelService,
    private typedEventEmitter: TypedEventEmitter,
    private appConfigService: AppConfigService,
    private characterTabButtonsService: CharacterTabButtonsService,
    private characterDiceButtonsService: CharacterDiceButtonsService,
    private diceRollChannelCreateHandler: DiceRollChannelCreateService,
    private characterChannelCreateHandler: CharacterChannelCreateService,
    private dicePagePrevButtonService: DicePagePrevButtonService,
    private dicePageNextButtonService: DicePageNextButtonService,
    private dicePageFirstButtonService: DicePageFirstButtonService,
    private dicePageLastButtonService: DicePageLastButtonService,
    private dicePageCancelButtonService: DicePageCancelButtonService,
    private diceCharacterSelectService: DiceCharacterSelectService,
    private characterThreadSelectService: CharacterThreadSelectService,
    private dicePageSelectMenuService: DicePageSelectMenuService,
    private channelCreateOrchestratorService: ChannelCreateOrchestratorService,
    private enhancedCharacterEditService: EnhancedCharacterEditService,
    private customDiceModalService: CustomDiceModalService
  ) {}

  private client: Client
  private interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction

  handleCommand(client: Client): void {
    this.client = client
    // インタラクション リスナーの登録は行わない（EventManagerServiceに委譲）
    this.handleChannelCreate(client)
  }

  // インタラクションハンドラー - 外部から呼び出される
  async handleInteraction(
    interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction
  ): Promise<void> {
    // 応答済みのインタラクションは処理しない
    if (interaction.replied || interaction.deferred) {
      this.logger.warn(`インタラクション(ID: ${interaction.id})は既に応答済みです。処理をスキップします。`)
      return
    }

    this.logger.log(
      `インタラクション処理開始: Type=${interaction.type}, ID=${interaction.id}, CustomID=${interaction.customId}`
    )
    this.interaction = interaction

    try {
      // ボタンインタラクションの処理
      if (interaction.isButton()) {
        this.logger.debug(`ボタン処理: ${interaction.customId}`)
        await this.handleButtonInteraction(interaction)
      }
      // セレクトメニューインタラクションの処理
      else if (interaction.isAnySelectMenu()) {
        this.logger.debug(`セレクトメニュー処理: ${interaction.customId}`)
        await this.handleSelectMenuInteraction(interaction)
      }
      // モーダル送信インタラクションの処理
      else if (interaction.isModalSubmit()) {
        this.logger.debug(`モーダル処理: ${interaction.customId}`)
        await this.handleModalSubmitInteraction(interaction)
      }
    } catch (error) {
      this.logger.error(`インタラクション処理中にエラーが発生: ${interaction.customId}`, error)

      // エラー応答（まだ応答していない場合のみ）
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: '❌ 処理中にエラーが発生しました。',
            ephemeral: true
          })
        } catch (replyError) {
          this.logger.error('エラー応答の送信に失敗', replyError)
        }
      }
    }
  }

  /**
   * ボタンインタラクション処理
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`ボタン処理: ${interaction.customId}`)

    // キャラクター関連ボタンの場合
    if (
      interaction.customId.startsWith('character-refresh-') ||
      interaction.customId.startsWith('character-edit-') ||
      interaction.customId.includes('character-tab-')
    ) {
      await this.enhancedCharacterEditService.handleButtonInteraction(interaction)
      return
    }

    // ダイスページネーション関連ボタン
    if (interaction.customId === 'dice-page-prev') {
      await this.doInteractions(this.dicePagePrevButtonService, { customId: 'dice-page-prev' })
      return
    }
    if (interaction.customId === 'dice-page-next') {
      await this.doInteractions(this.dicePageNextButtonService, { customId: 'dice-page-next' })
      return
    }
    if (interaction.customId === 'dice-page-first') {
      await this.doInteractions(this.dicePageFirstButtonService, { customId: 'dice-page-first' })
      return
    }
    if (interaction.customId === 'dice-page-last') {
      await this.doInteractions(this.dicePageLastButtonService, { customId: 'dice-page-last' })
      return
    }
    if (interaction.customId === 'dice-page-cancel') {
      await this.doInteractions(this.dicePageCancelButtonService, { customId: 'dice-page-cancel' })
      return
    }

    // ダイス関連ボタン
    if (interaction.customId.startsWith('character-dice')) {
      await this.doInteractions(this.characterDiceButtonsService, { customId: 'character-dice' })
      return
    }
    if (interaction.customId === 'dice_button') {
      await this.doInteractions(this.diceButtonService, { customId: 'dice_button' })
      return
    }

    // キャラクタータブボタン（character-thread用）
    if (interaction.customId === characterThreadIds.characterTabButtons.customId) {
      await this.doInteractions(this.characterTabButtonsService, {
        customId: characterThreadIds.characterTabButtons.customId
      })
      return
    }

    // その他のボタン処理
    this.logger.warn(`Unknown button customId: ${interaction.customId}`)
  }

  /**
   * セレクトメニューインタラクション処理
   */
  private async handleSelectMenuInteraction(interaction: AnySelectMenuInteraction): Promise<void> {
    const customId = interaction.customId

    // Character Thread Create Select（専用処理）
    if (customId === 'character-thread-create-select') {
      await this.doInteractions(this.characterThreadSelectService, { customId: 'character-thread-create-select' })
      return
    }

    // Enhanced Character Edit Service（統合済み）
    if (
      customId.startsWith('character-edit-') ||
      customId.startsWith('character-section-select-') ||
      customId.startsWith('character-field-')
    ) {
      await this.enhancedCharacterEditService.handleSelectMenuInteraction(interaction as any)
      return
    }

    // 通常のセレクトメニュー処理
    if (customId === 'dice-character-select') {
      await this.doInteractions(this.diceCharacterSelectService, { customId: 'dice-character-select' })
      return
    }

    if (customId === characterThreadIds.selectCharacterChannel.customId) {
      await this.doInteractions(this.characterThreadSelectService, {
        customId: characterThreadIds.selectCharacterChannel.customId
      })
      return
    }

    if (customId === 'dice-page-select') {
      await this.doInteractions(this.dicePageSelectMenuService, { customId: 'dice-page-select' })
      return
    }

    this.logger.warn(`Unknown select menu customId: ${customId}`)
  }

  /**
   * モーダル送信インタラクション処理
   */
  private async handleModalSubmitInteraction(interaction: ModalSubmitInteraction): Promise<void> {
    this.interaction = interaction

    // キャラクター編集モーダルの場合
    if (interaction.customId.startsWith('char-edit-') || interaction.customId.startsWith('char-edit-modal-')) {
      await this.enhancedCharacterEditService.handleModalSubmitInteraction(interaction)
      return
    }

    // カスタムダイスモーダルの場合
    if (interaction.customId === 'custom-dice-modal') {
      await this.doInteractions(this.customDiceModalService, { customId: 'custom-dice-modal' })
      return
    }

    // その他のモーダル処理
    this.logger.warn(`Unknown modal customId: ${interaction.customId}`)
  }

  /**
   * インタラクション処理の共通ロジック
   */
  private async doInteractions(service: any, eventData: eventType): Promise<void> {
    try {
      if (service?.execute && typeof service.execute === 'function') {
        await service.execute(this.interaction, eventData)
      }
    } catch (error) {
      this.logger.error(`サービス実行エラー: ${service.constructor.name}`, error)
    }
  }

  /**
   * チャンネル作成ハンドラー
   */
  private handleChannelCreate(client: Client): void {
    client.on(Events.ChannelCreate, async (channel: NonThreadGuildBasedChannel) => {
      if (channel.type !== ChannelType.GuildText) return

      const textChannel = channel
      this.logger.log(`チャンネル作成検出: ${textChannel.name} (${textChannel.id})`)

      try {
        // Channel Create Orchestrator による統合処理
        await this.channelCreateOrchestratorService.execute(textChannel)
      } catch (error) {
        this.logger.error(`チャンネル作成処理でエラーが発生: ${textChannel.name}`, error)
      }
    })
  }
}
