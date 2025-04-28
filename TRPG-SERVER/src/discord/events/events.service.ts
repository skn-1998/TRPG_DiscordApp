import { Injectable, OnModuleInit, Logger, Inject, Optional, forwardRef } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { Client, Interaction, ButtonInteraction, ModalSubmitInteraction, AnySelectMenuInteraction } from 'discord.js'
import { EventsController } from './events.controller'

/**
 * Discord イベントサービス
 * イベント管理とハンドリングを提供
 */
@Injectable()
export class EventsService implements OnModuleInit {
  private eventsController: EventsController
  private readonly logger = new Logger(EventsService.name)

  constructor(
    private readonly moduleRef: ModuleRef,
    // コントローラーを直接注入（Optionalでundefinedでも問題ないように設定）
    @Optional()
    @Inject(forwardRef(() => EventsController))
    private readonly injectedEventsController?: EventsController
  ) {
    // 直接注入されたコントローラーがあればそれを使用
    if (injectedEventsController) {
      this.eventsController = injectedEventsController
      this.logger.log('EventsControllerがコンストラクタで注入されました。')
    }
  }

  /**
   * モジュール初期化時にEventControllerを取得
   */
  async onModuleInit() {
    // すでにコンストラクタで注入されている場合はスキップ
    if (this.eventsController) {
      return
    }

    try {
      this.eventsController = this.moduleRef.get(EventsController, { strict: false })
      if (!this.eventsController) {
        this.logger.warn('EventsControllerを取得できませんでした。機能が制限される可能性があります。')
      } else {
        this.logger.log('EventsControllerを正常に取得しました。')
      }
    } catch (error) {
      this.logger.error('EventsControllerの取得中にエラーが発生しました:', error)
    }
  }

  /**
   * Discord クライアントをロードし、イベントハンドラを設定
   * @param client Discord クライアント
   */
  loadClient(client: Client): void {
    if (this.eventsController) {
      try {
        this.eventsController.handleCommand(client)
        this.logger.log('EventsControllerのhandleCommandを呼び出しました。')
      } catch (error) {
        this.logger.error('EventsControllerのhandleCommand呼び出し中にエラーが発生しました:', error)
      }
    } else {
      this.logger.warn('EventsControllerが利用できないため、handleCommandをスキップします。')
      // 代替処理をここに実装することもできます
    }
  }

  /**
   * インタラクションをEventsControllerに委譲する
   * EventManagerServiceとEventsControllerの間の仲介役として機能
   * @param interaction Discord インタラクション
   */
  async handleInteraction(
    interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction
  ): Promise<boolean> {
    try {
      if (this.eventsController) {
        await this.eventsController.handleInteraction(interaction)
        return true // 処理成功
      }
      this.logger.warn('インタラクション処理のためのEventsControllerが利用できません。')
      return false // コントローラーが利用できない
    } catch (error) {
      this.logger.error('EventsServiceでのハンドリングエラー:', error)
      return false // エラーが発生した
    }
  }
}
