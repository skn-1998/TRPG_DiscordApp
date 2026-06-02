import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  Events,
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
  CommandInteraction,
  AutocompleteInteraction
} from 'discord.js'
import { InteractionsService } from '../interactions/interactions.service'
import { CommandsService } from '../commands/commands.service'
import { DiscordButton, DiscordModal, DiscordSelectMenu } from '../interfaces/discord-interaction-types.interface'
import { AppConfigService } from '../../config/config.service'
import { ErrorHandler } from '../../utils/error-handler'

/**
 * Discord インタラクション処理サービス
 * DiscordServiceから分離して処理効率を向上
 */
@Injectable()
export class DiscordInteractionHandlerService {
  private readonly logger = new Logger(DiscordInteractionHandlerService.name)
  private initialized = false

  // インタラクション登録用のマップ
  private readonly buttons = new Map<string, DiscordButton>()
  private readonly modals = new Map<string, DiscordModal>()
  private readonly selects = new Map<string, DiscordSelectMenu>()

  // 処理済みインタラクションのIDを記録するSet（重複処理防止用）
  private readonly processedInteractions = new Set<string>()

  constructor(
    private readonly interactionsService: InteractionsService,
    private readonly commandsService: CommandsService,
    private readonly appConfigService: AppConfigService
  ) {}

  /**
   * サービスを初期化
   */
  async initialize(client: Client): Promise<void> {
    if (this.initialized) {
      return
    }

    this.setupInteractionListeners(client)
    this.initialized = true
  }

  /**
   * 初期化状態を取得
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Clientにインタラクションリスナーを設定
   */
  setupInteractionListeners(client: Client): void {
    // インタラクション処理の登録
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- discord.js の Client.on は async リスナーを await しない設計（handler 内で try/catch 済み）。fire-and-forget は意図的
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      await this.handleInteraction(interaction)
    })

    this.logger.log('Discord インタラクションリスナーを設定しました')
  }

  /**
   * インタラクション処理のメイン関数
   * 並列処理とエラーハンドリングを最適化
   */
  private async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      // 重複処理防止
      if (this.processedInteractions.has(interaction.id)) {
        this.logger.warn(`Duplicate interaction: ${interaction.id}`)
        return
      }
      this.processedInteractions.add(interaction.id)

      // インタラクションタイプ別の並列処理
      const handlers: Promise<void>[] = []

      if (interaction.isCommand()) {
        handlers.push(this.handleCommandInteraction(interaction))
      }

      if (interaction.isAutocomplete()) {
        handlers.push(this.handleAutocompleteInteraction(interaction))
      }

      if (interaction.isButton()) {
        handlers.push(this.handleButtonInteraction(interaction))
      }

      if (interaction.isAnySelectMenu()) {
        handlers.push(this.handleSelectMenuInteraction(interaction))
      }

      if (interaction.isModalSubmit()) {
        handlers.push(this.handleModalInteraction(interaction))
      }

      // 並列処理で効率化
      if (handlers.length > 0) {
        await Promise.allSettled(handlers)
      }
    } catch (error) {
      await ErrorHandler.handleError(error, {
        context: 'discord-interaction-handler',
        interactionId: interaction.id,
        additionalData: { interactionType: interaction.type }
      })
    } finally {
      // メモリリーク防止のため一定時間後に削除
      setTimeout(() => {
        this.processedInteractions.delete(interaction.id)
      }, 300000) // 5分
    }
  }

  /**
   * コマンドインタラクション処理
   */
  private async handleCommandInteraction(interaction: CommandInteraction): Promise<void> {
    this.logger.debug(`Processing command: ${interaction.commandName}`)
    await this.commandsService.execute(interaction)
  }

  /**
   * オートコンプリートインタラクション処理
   */
  private async handleAutocompleteInteraction(interaction: AutocompleteInteraction): Promise<void> {
    this.logger.debug(`Processing autocomplete: ${interaction.commandName}`)
    await this.commandsService.autocomplete(interaction)
  }

  /**
   * ボタンインタラクション処理（最適化済み）
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    this.logger.debug(`Processing button: ${interaction.customId}`)

    // キャッシュされたハンドラーから直接実行
    const handler = this.buttons.get(interaction.customId)
    if (handler) {
      await handler.execute(interaction)
    } else {
      // fallback to events service
      await this.interactionsService.execute(interaction)
    }
  }

  /**
   * セレクトメニューインタラクション処理（最適化済み）
   */
  private async handleSelectMenuInteraction(interaction: AnySelectMenuInteraction): Promise<void> {
    this.logger.debug(`Processing select menu: ${interaction.customId}`)

    // 登録されたハンドラーを優先
    const handler = this.selects.get(interaction.customId)
    if (handler) {
      await handler.execute(interaction)
      return
    }

    // character-section-selectパターンは直接InteractionsServiceで処理
    if (interaction.customId.startsWith('character-section-select-')) {
      await this.interactionsService.execute(interaction)
      return
    }

    // その他のセレクトメニューもInteractionsServiceで処理
    await this.interactionsService.execute(interaction)
  }

  /**
   * モーダルインタラクション処理（最適化済み）
   */
  private async handleModalInteraction(interaction: ModalSubmitInteraction): Promise<void> {
    this.logger.debug(`Processing modal: ${interaction.customId}`)

    const handler = this.modals.get(interaction.customId)
    if (handler) {
      await handler.execute(interaction)
    } else {
      await this.interactionsService.execute(interaction)
    }
  }

  /**
   * インタラクションハンドラーの登録（パフォーマンス最適化）
   */
  registerButton(customId: string, handler: DiscordButton): void {
    this.buttons.set(customId, handler)
    this.logger.debug(`Registered button handler: ${customId}`)
  }

  registerModal(customId: string, handler: DiscordModal): void {
    this.modals.set(customId, handler)
    this.logger.debug(`Registered modal handler: ${customId}`)
  }

  registerSelectMenu(customId: string, handler: DiscordSelectMenu): void {
    this.selects.set(customId, handler)
    this.logger.debug(`Registered select menu handler: ${customId}`)
  }

  /**
   * 統計情報取得
   */
  getHandlerStats(): { buttons: number; modals: number; selects: number; processedCount: number } {
    return {
      buttons: this.buttons.size,
      modals: this.modals.size,
      selects: this.selects.size,
      processedCount: this.processedInteractions.size
    }
  }

  /**
   * キャッシュクリア（メモリ管理）
   */
  clearExpiredInteractions(): void {
    const toDelete = Array.from(this.processedInteractions).filter((_id) => {
      // IDから時間を抽出できない場合は削除
      return true
    })

    toDelete.forEach((id) => this.processedInteractions.delete(id))

    if (toDelete.length > 0) {
      this.logger.debug(`Cleared ${toDelete.length} expired interaction records`)
    }
  }
}
