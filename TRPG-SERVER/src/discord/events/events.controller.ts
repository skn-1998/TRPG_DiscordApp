/* eslint-disable no-unused-vars */
import { Controller, Logger, Inject, forwardRef } from '@nestjs/common'
import { CharaInfoButtonService } from '../features/characterEdit/chara-info-button.service'
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
import { ChangeCharaInfoService } from '../features/characterEdit/change-chara-info.service'
import { CharacterChannelService } from '../features/characterThread/character-channel.service'
import { AddCharaInfoService } from '../features/characterEdit/add-chara-info.service'
import { characterEditIds } from '../features/characterEdit/events/character-edit.ids'
import type { eventSelectButtonType, eventType, eventButtonType } from './events.list'
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
// システムイベントハンドラーの型定義
export type systemEventHandlerType = {
  execute: (channel: TextChannel, config: string) => void | Promise<void>
}

@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name)

  constructor(
    private charaInfoButtonService: CharaInfoButtonService,
    private diceButtonService: DiceButtonService,
    private addCharaInfoService: AddCharaInfoService,
    private changeCharaInfoService: ChangeCharaInfoService,
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
    private enhancedCharacterEditService: EnhancedCharacterEditService
  ) {}

  private client: Client
  private interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction

  handleCommand(client: Client): void {
    this.client = client
    // イベントリスナーの登録は行わない（EventManagerServiceに委譲）
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

        // 通常のボタン処理
        await this.doEvents(this.charaInfoButtonService, { customId: characterEditIds.addCharacterInfo.customId })
        await this.doEvents(this.charaInfoButtonService, { customId: characterEditIds.changeCharacterInfo.customId })
        // diceButtonはfeaturesのAdapterでcustomIdを持つため、直接マッチング
        await this.doEvents(this.diceButtonService, { customId: 'dice_button' })
        await this.doEvents(this.characterTabButtonsService, {
          customId: characterThreadIds.characterTabButtons.customId
        })
        // characterDiceButtons は 'roll*' プレフィクスでワイルドカードマッチ
        await this.doEvents(this.characterDiceButtonsService, { customId: 'roll*' })
        await this.doEvents(this.dicePagePrevButtonService, { customId: 'dice-prev*' })
        await this.doEvents(this.dicePageNextButtonService, { customId: 'dice-next*' })
        await this.doEvents(this.dicePageFirstButtonService, { customId: 'dice-first*' })
        await this.doEvents(this.dicePageLastButtonService, { customId: 'dice-last*' })
        await this.doEvents(this.dicePageCancelButtonService, { customId: 'dice-cancel*' })

        // Enhanced Character Edit Service のボタン処理
        await this.doEnhancedCharacterEditEvents('character-refresh-*')
        await this.doEnhancedCharacterEditEvents('character-compact-view-*')
      }

      // セレクトメニューインタラクションの処理
      else if (interaction.isStringSelectMenu()) {
        this.logger.debug(`セレクトメニュー処理: ${interaction.customId}`)

        // 通常のセレクトメニュー処理
        await this.doEvents(this.characterChannelService, {
          customId: characterThreadIds.selectCharacterChannel.customId
        })
        await this.doEvents(this.changeCharaInfoService, { customId: characterEditIds.addCharacterInfo.customId })
        await this.doEvents(this.changeCharaInfoService, { customId: characterEditIds.changeCharacterInfo.customId })
        await this.doEvents(this.diceCharacterSelectService, { customId: 'dice-char-select*' })
        await this.doEvents(this.characterThreadSelectService, { customId: 'character-thread-*' })
        await this.doEvents(this.dicePageSelectMenuService, { customId: 'dice-page-select*' })

        // Enhanced Character Edit Service のセレクトメニュー処理
        await this.doEnhancedCharacterEditEvents('character-edit-section-*')
        await this.doEnhancedCharacterEditEvents('character-field-edit-*')
        await this.doEnhancedCharacterEditEvents('character-field-add-*')
      }

      // モーダルインタラクションの処理
      else if (interaction.isModalSubmit()) {
        this.logger.debug(`モーダル処理: ${interaction.customId}`)
        await this.doEvents(this.addCharaInfoService, { customId: characterEditIds.addCharacterInfo.customId })
        await this.doEvents(this.addCharaInfoService, { customId: characterEditIds.changeCharacterInfo.customId })

        // Enhanced Character Edit Service のモーダル処理
        await this.doEnhancedCharacterEditEvents('character-create-basic-*')
        await this.doEnhancedCharacterEditEvents('char-edit-modal-*') // セッション形式
        await this.doEnhancedCharacterEditEvents('character-edit-modal-*') // 従来形式サポート

        // 短いID直接形式 (char-edit-{section}-{field}-{shortId})
        await this.doEnhancedCharacterEditEventsForDirectId()
      }

      // インタラクションが応答されなかった場合
      if (!(interaction.replied || interaction.deferred)) {
        this.logger.warn(
          `インタラクション(ID: ${interaction.id}, CustomID=${interaction.customId})に対して応答が行われませんでした。`
        )
      } else {
        this.logger.log(`インタラクション処理完了: ID=${interaction.id}`)
      }
    } catch (error) {
      this.logger.error(`インタラクション処理エラー(ID: ${interaction.id}):`, error)

      // エラー発生時に未応答の場合は応答する
      if (!(interaction.replied || interaction.deferred)) {
        try {
          await interaction.reply({
            content: '処理中にエラーが発生しました。しばらく経ってから再度お試しください。',
            ephemeral: true
          })
        } catch (replyError) {
          this.logger.error('エラー応答中にさらにエラーが発生しました:', replyError)
        }
      }
    }
  }

  handleChannelCreate(client: Client): void {
    this.logger.log('チャンネル作成ハンドラーを呼び出します')
    this.client = client
    client.on(Events.ChannelCreate, async (channel: NonThreadGuildBasedChannel): Promise<void> => {
      if (!(channel.type === ChannelType.GuildText)) return

      // キャラクターチャンネル作成ハンドラー
      this.doSystemEvent(
        this.characterChannelCreateHandler,
        this.appConfigService.get('discord.characterCategory'),
        channel
      )
      this.doSystemEvent(
        this.diceRollChannelCreateHandler,
        this.appConfigService.get('discord.diceRollCategory'),
        channel
      )
    })
  }
  /**
   * システムイベントハンドラーを呼び出す
   * @param handler イベントハンドラー
   * @param config イベント設定
   * @param client Discordクライアント
   */
  doSystemEvent(handler: systemEventHandlerType, categoryId: string, channel: TextChannel): void {
    this.logger.debug(`システムイベント実行: ${categoryId}`)

    // channel.parentのnullチェック
    if (!channel.parent) {
      this.logger.debug('チャンネルに親カテゴリがありません')
      return
    }

    console.log(channel.parent.name + categoryId)
    if (channel.parent.name === categoryId) {
      console.log(channel.parent.name)
      handler.execute(channel, categoryId)
    }
  }

  async doEvents(
    discordClass: discordInteractionType,
    config: eventSelectButtonType | eventType | eventButtonType
  ): Promise<void> {
    if (isUndefined(config.customId)) return

    // 応答済みのインタラクションは処理しない
    if (this.interaction.replied || this.interaction.deferred) {
      return
    }

    if (this.interaction?.customId === config.customId) {
      this.logger.debug(`イベント実行: ${config.customId}`)
      await discordClass.execute(this.interaction, config)
    }
    // ワイルドカードマッチング: config.customIdに*が含まれている場合
    else if (config.customId.includes('*')) {
      const basePattern = config.customId.replace('*', '')
      if (this.interaction?.customId.startsWith(basePattern)) {
        this.logger.debug(`ワイルドカードイベント実行: ${this.interaction.customId} (マッチ: ${config.customId})`)
        await discordClass.execute(this.interaction, config)
      }
    }
  }

  /**
   * Enhanced Character Edit Service のイベントを処理する
   */
  private async doEnhancedCharacterEditEvents(pattern: string): Promise<void> {
    // 応答済みのインタラクションは処理しない
    if (this.interaction.replied || this.interaction.deferred) {
      this.logger.debug(`Skipping pattern ${pattern}: interaction already replied/deferred`)
      return
    }

    // ワイルドカードパターンマッチング
    const basePattern = pattern.replace('*', '')
    this.logger.debug(
      `Checking pattern: ${pattern} (base: ${basePattern}) against customId: ${this.interaction.customId}`
    )

    if (this.interaction.customId.startsWith(basePattern)) {
      this.logger.log(`Enhanced Character Edit イベント実行: ${this.interaction.customId} (pattern: ${pattern})`)

      if (this.interaction.isButton()) {
        await this.enhancedCharacterEditService.handleButtonInteraction(this.interaction)
      } else if (this.interaction.isStringSelectMenu()) {
        await this.enhancedCharacterEditService.handleSelectMenuInteraction(this.interaction)
      } else if (this.interaction.isModalSubmit()) {
        this.logger.debug(`Processing modal submit for: ${this.interaction.customId}`)
        await this.enhancedCharacterEditService.handleModalSubmitInteraction(this.interaction)
      }
    } else {
      this.logger.debug(`Pattern ${pattern} does not match customId: ${this.interaction.customId}`)
    }
  }

  /**
   * 短いID直接形式のモーダル処理 (char-edit-{section}-{field}-{shortId})
   */
  private async doEnhancedCharacterEditEventsForDirectId(): Promise<void> {
    // 応答済みのインタラクションは処理しない
    if (this.interaction.replied || this.interaction.deferred) {
      this.logger.debug(`Skipping direct ID pattern: interaction already replied/deferred`)
      return
    }

    const customId = this.interaction.customId

    // char-edit-{section}-{field}-{shortId} 形式をチェック
    // セッション形式 (char-edit-modal-) を除外
    if (customId.startsWith('char-edit-') && !customId.startsWith('char-edit-modal-')) {
      // パターン: char-edit-status-add_new-se4e74ws のような形式
      const parts = customId.split('-')

      // 最低4つの部分が必要: ['char', 'edit', '{section}', '{field}', ...]
      if (parts.length >= 4) {
        this.logger.log(`Direct ID modal event: ${customId}`)

        if (this.interaction.isModalSubmit()) {
          this.logger.debug(`Processing direct ID modal submit for: ${customId}`)
          await this.enhancedCharacterEditService.handleModalSubmitInteraction(this.interaction)
        }
      } else {
        this.logger.debug(`Direct ID pattern insufficient parts: ${parts.length}, customId: ${customId}`)
      }
    }
  }
}
