import { Injectable, OnModuleInit, Logger, Inject, Optional, forwardRef } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Client, Interaction, ButtonInteraction, ModalSubmitInteraction, AnySelectMenuInteraction } from 'discord.js'
import { InteractionsController } from './interactions.controller'

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
export class InteractionsService implements OnModuleInit {
  private interactionsController: InteractionsController
  private readonly logger = new Logger(InteractionsService.name)

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly eventEmitter: EventEmitter2,
    // コントローラーを直接注入（Optionalでundefinedでも問題ないように設定）
    @Optional()
    @Inject(forwardRef(() => InteractionsController))
    private readonly injectedInteractionsController?: InteractionsController
  ) {
    // 直接注入されたコントローラーがあればそれを使用
    if (injectedInteractionsController) {
      this.interactionsController = injectedInteractionsController
      this.logger.log('InteractionsControllerがコンストラクタで注入されました。')
    }
  }

  /**
   * モジュール初期化時にInteractionsControllerを取得
   */
  async onModuleInit() {
    // すでにコンストラクタで注入されている場合はスキップ
    if (this.interactionsController) {
      return
    }

    try {
      this.interactionsController = this.moduleRef.get(InteractionsController, { strict: false })
      if (!this.interactionsController) {
        this.logger.warn('InteractionsControllerを取得できませんでした。機能が制限される可能性があります。')
      } else {
        this.logger.log('InteractionsControllerを正常に取得しました。')
      }
    } catch (error) {
      this.logger.error('InteractionsControllerの取得中にエラーが発生しました:', error)
    }
  }

  /**
   * Discord クライアントをロードし、インタラクションハンドラを設定
   * @param client Discord クライアント
   */
  loadClient(client: Client): void {
    if (this.interactionsController) {
      try {
        this.interactionsController.handleCommand(client)
        this.logger.log('InteractionsControllerのhandleCommandを呼び出しました。')
      } catch (error) {
        this.logger.error('InteractionsControllerのhandleCommand呼び出し中にエラーが発生しました:', error)
      }
    } else {
      this.logger.warn('InteractionsControllerが利用できないため、handleCommandをスキップします。')
    }
  }

  /**
   * インタラクションをInteractionsControllerに委譲する
   * EventManagerServiceとInteractionsControllerの間の仲介役として機能
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
          `インタラクション(ID: ${interaction.id})は既に応答済みです。InteractionsControllerへの委譲をスキップします。`
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

      if (this.interactionsController) {
        this.logger.log(`インタラクション(ID: ${interaction.id})をInteractionsControllerに委譲します。`)
        await this.interactionsController.handleInteraction(interaction)

        const duration = Date.now() - startTime

        // 成功メトリクス記録
        this.eventEmitter.emit('discord.interaction.processed', {
          eventType: `${interactionType}-interaction`,
          success: true,
          duration,
          interactionId: interaction.id
        })

        return true // 処理成功
      }

      const duration = Date.now() - startTime
      this.logger.warn('インタラクション処理のためのInteractionsControllerが利用できません。')

      // エラーメトリクス記録
      this.eventEmitter.emit('discord.interaction.processed', {
        eventType: `${interactionType}-interaction`,
        success: false,
        duration,
        error: 'controller-unavailable'
      })

      return false // コントローラーが利用できない
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
   */
  async execute(interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
    await this.handleInteraction(interaction)
  }
}
