import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  Client,
  Events,
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
  NonThreadGuildBasedChannel,
  ChannelType
} from 'discord.js'
import { ChannelCreateOrchestratorService } from '../features/characterEdit/services/channel-create-orchestrator.service'
import { InteractionRegistryService } from './registry/interaction-registry.service'

/**
 * Discord インタラクションサービス
 *
 * 目的: Discord.js インタラクション処理の統合管理
 * 責務: ボタン、モーダル、セレクトメニューのインタラクション処理
 *
 * 注意: Global Events (/events) とは責務が異なります
 * - Global Events: アプリケーション全体のイベント統合
 * - Discord Interactions: Discord.js固有のユーザーインタラクション処理
 */
@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name)

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly interactionRegistry: InteractionRegistryService,
    private readonly channelCreateOrchestratorService: ChannelCreateOrchestratorService
  ) {}

  /**
   * Discord クライアントをロードし、インタラクションハンドラを設定
   * @param client Discord クライアント
   */
  loadClient(client: Client): void {
    this.handleChannelCreate(client)
    this.logger.log('ChannelCreateリスナーを登録しました。')
  }

  /**
   * インタラクションをInteractionRegistryServiceに委譲する
   * @param interaction Discord インタラクション
   */
  async handleInteraction(
    interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction
  ): Promise<boolean> {
    const startTime = Date.now()
    const interactionType = interaction.isButton() ? 'button' : interaction.isAnySelectMenu() ? 'select' : 'modal'

    // インタラクション処理開始メトリクス
    this.eventEmitter.emit('discord.interaction.start', {
      eventType: `${interactionType}-interaction`,
      interactionId: interaction.id,
      userId: interaction.user.id,
      guildId: interaction.guildId
    })

    try {
      // 応答済みのインタラクションは処理しない
      if (interaction.replied || interaction.deferred) {
        const duration = Date.now() - startTime
        this.logger.warn(
          `インタラクション(ID: ${interaction.id})は既に応答済みです。InteractionRegistryServiceへの委譲をスキップします。`
        )

        // 処理済みメトリクス記録
        this.eventEmitter.emit('discord.interaction.processed', {
          eventType: `${interactionType}-interaction`,
          success: true,
          duration,
          reason: 'already-replied'
        })
        return true // すでに処理済みとみなす
      }

      this.logger.log(`インタラクション(ID: ${interaction.id})をInteractionRegistryServiceに委譲します。`)
      await this.routeInteraction(interaction)

      const duration = Date.now() - startTime

      // 成功メトリクス記録
      this.eventEmitter.emit('discord.interaction.processed', {
        eventType: `${interactionType}-interaction`,
        success: true,
        duration,
        interactionId: interaction.id
      })

      return true // 処理成功
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(`InteractionsServiceでのハンドリングエラー(ID: ${interaction.id}):`, error)

      // エラーメトリクス記録
      this.eventEmitter.emit('discord.interaction.processed', {
        eventType: `${interactionType}-interaction`,
        success: false,
        duration,
        error: (error as Error).message
      })

      return false // エラーが発生した
    }
  }

  /**
   * インタラクション実行（discord-interaction-handler.service.tsとの互換性のため）
   *
   * 旧: characterEdit セレクト（character-section-select-/character-edit-/character-field-）の特例分岐で
   *     CharacterSectionEditorService を直接呼んでいたが、これは registry の
   *     CharacterEditSectionHandler / CharacterEditFieldHandler を影で潰す legacy bypass だった。
   *     特例を撤去し、全インタラクションを Registry へ委譲する（§8・feature 所有の handler が処理）。
   */
  async execute(interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
    // 応答済みインタラクションの重複処理を防止
    if (interaction.replied || interaction.deferred) {
      this.logger.warn(`インタラクション(ID: ${interaction.id})は既に応答済みです。処理をスキップします。`)
      return
    }

    await this.handleInteraction(interaction)
  }

  private async routeInteraction(
    interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction
  ): Promise<void> {
    this.logger.log(
      `インタラクション処理開始: Type=${interaction.type}, ID=${interaction.id}, CustomID=${interaction.customId}`
    )

    try {
      const handled = await this.interactionRegistry.route(interaction)

      if (!handled) {
        this.logger.warn(`未登録のインタラクション: ${interaction.customId}`)

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '⚠️ このインタラクションは現在処理できません。',
            ephemeral: true
          })
        }
      }
    } catch (error) {
      this.logger.error(`インタラクション処理中にエラーが発生: ${interaction.customId}`, error)

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

  private handleChannelCreate(client: Client): void {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- discord.js の Client.on は async リスナーを await しない設計（handler 内で try/catch 済み）。fire-and-forget は意図的
    client.on(Events.ChannelCreate, async (channel: NonThreadGuildBasedChannel) => {
      if (channel.type !== ChannelType.GuildText) return

      const textChannel = channel
      this.logger.log(`チャンネル作成検出: ${textChannel.name} (${textChannel.id})`)

      try {
        await this.channelCreateOrchestratorService.execute(textChannel)
      } catch (error) {
        this.logger.error(`チャンネル作成処理でエラーが発生: ${textChannel.name}`, error)
      }
    })
  }
}
