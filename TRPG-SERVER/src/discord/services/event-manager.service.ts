import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  Client,
  Events,
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction
} from 'discord.js'
import { DiscordClientService } from './discord-client.service'
import { DiscordButton, DiscordModal, DiscordSelectMenu } from '../interfaces/discord-interaction-types.interface'
import { EventsService } from '../events/events.service'

/**
 * イベントマネージャーサービス
 * Discord Botのイベント管理、登録、実行を担当
 */
@Injectable()
export class EventManagerService implements OnModuleInit {
  private readonly logger = new Logger(EventManagerService.name)
  private readonly buttons = new Map<string, DiscordButton>()
  private readonly modals = new Map<string, DiscordModal>()
  private readonly selects = new Map<string, DiscordSelectMenu>()

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly eventsService: EventsService
  ) {}

  /**
   * モジュール初期化時に呼び出される
   */
  async onModuleInit(): Promise<void> {
    const client = this.discordClientService.getClient()
    this.setupEventHandlers(client)
  }

  /**
   * ボタンを登録する
   * @param button ボタン
   */
  registerButton(button: DiscordButton): void {
    this.logger.log(`ボタン「${button.name}」を登録しています`)
    this.buttons.set(button.id, button)
  }

  /**
   * モーダルを登録する
   * @param modal モーダル
   */
  registerModal(modal: DiscordModal): void {
    this.logger.log(`モーダル「${modal.name}」を登録しています`)
    this.modals.set(modal.id, modal)
  }

  /**
   * セレクトメニューを登録する
   * @param select セレクトメニュー
   */
  registerSelectMenu(select: DiscordSelectMenu): void {
    this.logger.log(`セレクトメニュー「${select.name}」を登録しています`)
    this.selects.set(select.id, select)
  }

  /**
   * イベントハンドラをセットアップする
   * @param client Discordクライアント
   */
  private setupEventHandlers(client: Client): void {
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      try {
        // 一度インタラクションのみ処理するための保護措置
        let interactionHandled = false

        // ボタン、モーダル、セレクトメニューのインタラクションをEventsServiceに委譲
        if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
          // EventsServiceを通してコントローラーにインタラクションを委譲
          try {
            if (interaction.isButton()) {
              interactionHandled = await this.eventsService.handleInteraction(interaction)
            } else if (interaction.isModalSubmit()) {
              interactionHandled = await this.eventsService.handleInteraction(interaction)
            } else if (interaction.isStringSelectMenu()) {
              interactionHandled = await this.eventsService.handleInteraction(interaction)
            }
          } catch (error) {
            this.logger.error('EventsServiceでの処理中にエラーが発生しました')
            this.logger.error(error)
            interactionHandled = false
          }

          // フォールバック処理：EventsServiceが処理しなかった場合
          if (!interactionHandled && !interaction.replied && !interaction.deferred) {
            if (interaction.isButton()) {
              await this.handleButtonInteraction(interaction)
            } else if (interaction.isModalSubmit()) {
              await this.handleModalInteraction(interaction)
            } else if (interaction.isAnySelectMenu()) {
              await this.handleSelectMenuInteraction(interaction)
            }
          }
        }
      } catch (error) {
        this.logger.error('相互作用の処理中にエラーが発生しました')
        if (error instanceof Error) {
          this.logger.error(error.message)
        }
      }
    })
  }

  /**
   * ボタン相互作用を処理する
   * @param interaction ボタン相互作用
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId
    // カスタムIDにはプレフィックスやパラメータが含まれていることがあるため、プレフィックス部分を抽出
    const buttonId = customId.split(':')[0]
    const button = this.buttons.get(buttonId)

    if (!button) {
      this.logger.warn(`未登録のボタン「${buttonId}」が押されました`)
      await interaction.reply({
        content: '無効なボタンです。管理者に問い合わせてください。',
        ephemeral: true
      })
      return
    }

    try {
      await button.execute(interaction)
    } catch (error) {
      this.logger.error(`ボタン「${buttonId}」の処理中にエラーが発生しました`)
      if (error instanceof Error) {
        this.logger.error(error.message)
      }

      const replyOptions = {
        content: 'ボタン処理中にエラーが発生しました。',
        ephemeral: true
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyOptions)
      } else {
        await interaction.reply(replyOptions)
      }
    }
  }

  /**
   * モーダル相互作用を処理する
   * @param interaction モーダル相互作用
   */
  private async handleModalInteraction(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = interaction.customId
    // カスタムIDにはプレフィックスやパラメータが含まれていることがあるため、プレフィックス部分を抽出
    const modalId = customId.split(':')[0]
    const modal = this.modals.get(modalId)

    if (!modal) {
      this.logger.warn(`未登録のモーダル「${modalId}」が送信されました`)
      await interaction.reply({
        content: '無効なフォームです。管理者に問い合わせてください。',
        ephemeral: true
      })
      return
    }

    try {
      await modal.execute(interaction)
    } catch (error) {
      this.logger.error(`モーダル「${modalId}」の処理中にエラーが発生しました`)
      if (error instanceof Error) {
        this.logger.error(error.message)
      }

      const replyOptions = {
        content: 'フォーム処理中にエラーが発生しました。',
        ephemeral: true
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyOptions)
      } else {
        await interaction.reply(replyOptions)
      }
    }
  }

  /**
   * セレクトメニュー相互作用を処理する
   * @param interaction セレクトメニュー相互作用
   */
  private async handleSelectMenuInteraction(interaction: AnySelectMenuInteraction): Promise<void> {
    const customId = interaction.customId
    // カスタムIDにはプレフィックスやパラメータが含まれていることがあるため、プレフィックス部分を抽出
    const selectId = customId.split(':')[0]
    const select = this.selects.get(selectId)

    if (!select) {
      this.logger.warn(`未登録のセレクトメニュー「${selectId}」が選択されました`)
      await interaction.reply({
        content: '無効なメニューです。管理者に問い合わせてください。',
        ephemeral: true
      })
      return
    }

    try {
      await select.execute(interaction)
    } catch (error) {
      this.logger.error(`セレクトメニュー「${selectId}」の処理中にエラーが発生しました`)
      if (error instanceof Error) {
        this.logger.error(error.message)
      }

      const replyOptions = {
        content: 'メニュー処理中にエラーが発生しました。',
        ephemeral: true
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyOptions)
      } else {
        await interaction.reply(replyOptions)
      }
    }
  }
}
