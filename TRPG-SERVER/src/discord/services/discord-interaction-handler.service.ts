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
import { ErrorHandler } from '../../core/http/error-handler'

/**
 * Discord インタラクション処理サービス
 * client.on(InteractionCreate) の唯一の入口。型ガードで振り分け、
 *   - command / autocomplete → CommandsService
 *   - button / select / modal → InteractionsService（Registry へ一本化）
 * へ直結する。customId ルーティングの実体は InteractionRegistryService が持つ。
 *
 * 旧: 本サービス内の Map キャッシュ（buttons/modals/selects）と register* API は
 *     本番で一度も登録されず常に fallback される dead 構造だったため撤去（E-5）。
 *     interaction.id の dedup Set による重複ガードも撤去済み — discord.js は同一 interaction を
 *     二重配信せず、下流 InteractionsService にも replied/deferred チェックがある。
 */
@Injectable()
export class DiscordInteractionHandlerService {
  private readonly logger = new Logger(DiscordInteractionHandlerService.name)
  private initialized = false

  constructor(
    private readonly interactionsService: InteractionsService,
    private readonly commandsService: CommandsService
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
   * 委譲先の reject は Promise.allSettled が吸収し、型ガード等の同期例外は
   * ErrorHandler へ委譲する。いずれの場合もリスナーは落ちない。
   */
  private async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      const handlers: Promise<void>[] = []

      if (interaction.isCommand()) {
        handlers.push(this.handleCommandInteraction(interaction))
      }

      if (interaction.isAutocomplete()) {
        handlers.push(this.handleAutocompleteInteraction(interaction))
      }

      if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
        handlers.push(this.handleComponentInteraction(interaction))
      }

      if (handlers.length > 0) {
        await Promise.allSettled(handlers)
      }
    } catch (error) {
      await ErrorHandler.handleError(error, {
        context: 'discord-interaction-handler',
        interactionId: interaction.id,
        additionalData: { interactionType: interaction.type }
      })
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
   * コンポーネント系（ボタン / セレクトメニュー / モーダル）インタラクション処理
   * customId ルーティングは InteractionsService（Registry）に一本化して委譲する。
   * character-section-select- / character-edit- / character-field- も Registry の
   * CharacterEditSection/FieldHandler が処理する（特例分岐なし）。
   */
  private async handleComponentInteraction(
    interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction
  ): Promise<void> {
    this.logger.debug(`Processing component: ${interaction.customId}`)
    await this.interactionsService.execute(interaction)
  }
}
