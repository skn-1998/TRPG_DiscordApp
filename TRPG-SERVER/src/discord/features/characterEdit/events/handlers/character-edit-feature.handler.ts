import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../../../../core/events/typed-event.service'
import { EventPayload, EVENT_NAMES } from '../../../../../events/contracts'

/**
 * Character Edit Feature Event Handler
 * characterEdit機能内部のイベントハンドラー
 * Feature内部イベントとグローバルイベントの橋渡し
 */
@Injectable()
export class CharacterEditFeatureHandler implements OnModuleInit {
  private readonly logger = new Logger(CharacterEditFeatureHandler.name)

  constructor(private readonly typedEventService: TypedEventService) {}

  onModuleInit(): void {
    this.registerFeatureEventHandlers()
    this.logger.log('Character Edit Feature Handler initialized')
  }

  /**
   * Feature内部イベントハンドラー登録
   */
  private registerFeatureEventHandlers(): void {
    // Modal Events
    this.typedEventService.on(EVENT_NAMES.CHARACTER_EDIT_MODAL_OPENED, this.handleModalOpened.bind(this))
    this.typedEventService.on(EVENT_NAMES.CHARACTER_EDIT_MODAL_SUBMITTED, this.handleModalSubmitted.bind(this))

    // Embed Events
    this.typedEventService.on(
      EVENT_NAMES.CHARACTER_EDIT_EMBED_REFRESH_REQUESTED,
      this.handleEmbedRefreshRequested.bind(this)
    )

    // Error Events
    this.typedEventService.on(EVENT_NAMES.CHARACTER_EDIT_ERROR_OCCURRED, this.handleFeatureError.bind(this))

    this.logger.debug('Character edit feature event handlers registered')
  }

  /**
   * モーダル開始イベントハンドラー
   */
  private async handleModalOpened(event: EventPayload<'characterEdit.modal.opened'>): Promise<void> {
    this.logger.debug(`📝 Modal Opened: ${event.modal.sectionType}.${event.modal.fieldKey}`)

    try {
      // Feature内部のワークフロー処理
      // 例: UI状態管理、セッション開始など
      // 必要に応じてグローバルイベント発行
      // この例では内部イベントなのでグローバル発行は不要
    } catch (error) {
      this.logger.error(`❌ Modal opened event processing failed`, error)
      await this.emitFeatureError('MODAL_OPENED_HANDLER_ERROR', error, event)
    }
  }

  /**
   * モーダル送信イベントハンドラー
   */
  private async handleModalSubmitted(event: EventPayload<'characterEdit.modal.submitted'>): Promise<void> {
    this.logger.debug(`📤 Modal Submitted: ${event.modal.sectionType}.${event.modal.fieldKey}`)

    try {
      // Feature内部での値更新処理は別のサービスが担当
      // （実際の modal → キャラ更新は character-modal-handler.service が CharacterService を
      //  DI 直呼びで更新し、character.update.completed を通知として発行する: E-2d）
      // ここではイベントログ記録とワークフロー管理のみ

      // Embed更新リクエスト発行
      await this.typedEventService.emit(EVENT_NAMES.CHARACTER_EDIT_EMBED_REFRESH_REQUESTED, {
        characterId: event.characterId,
        timestamp: new Date(),
        userId: event.userId,
        embed: {
          channelId: '', // 実際のchannelIdは別途取得
          embedType: 'enhanced',
          section: event.modal.sectionType
        }
      })
    } catch (error) {
      this.logger.error(`❌ Modal submitted event processing failed`, error)
      await this.emitFeatureError('MODAL_SUBMITTED_HANDLER_ERROR', error, event)
    }
  }

  /**
   * Embed更新リクエストイベントハンドラー
   */
  private async handleEmbedRefreshRequested(
    event: EventPayload<'characterEdit.embed.refresh.requested'>
  ): Promise<void> {
    this.logger.debug(`🎨 Embed Refresh Requested: ${event.embed.embedType}`)

    try {
      // グローバルDiscord Embed更新イベント発行
      await this.typedEventService.emit(EVENT_NAMES.DISCORD_EMBED_UPDATE_REQUESTED, {
        timestamp: new Date(),
        source: 'discord',
        channelId: event.embed.channelId,
        embedData: {
          channelId: event.embed.channelId,
          characterId: event.characterId,
          embedType: event.embed.embedType,
          updateMode: 'refresh'
        }
      })
    } catch (error) {
      this.logger.error(`❌ Embed refresh requested event processing failed`, error)
      await this.emitFeatureError('EMBED_REFRESH_HANDLER_ERROR', error, event)
    }
  }

  /**
   * Feature内エラーイベントハンドラー
   */
  private async handleFeatureError(event: EventPayload<'characterEdit.error.occurred'>): Promise<void> {
    this.logger.error(`🚨 Character Edit Feature Error: ${event.error.code} - ${event.error.message}`)
    // 旧レガシーバスへの system.error.occurred 発行は dead のため撤去（ログ記録のみ）
  }

  /**
   * Feature内エラーイベント発行ヘルパー
   */
  private async emitFeatureError(code: string, error: any, originalEvent: any): Promise<void> {
    try {
      await this.typedEventService.emit(EVENT_NAMES.CHARACTER_EDIT_ERROR_OCCURRED, {
        characterId: originalEvent.characterId,
        timestamp: new Date(),
        userId: originalEvent.userId,
        error: {
          code,
          message: error.message || 'Unknown error',
          // E-4a: 契約から type フィールドを撤去したため、診断用 operation はハンドラ文脈（code）を使う
          operation: code,
          details: { originalEvent, stack: error.stack },
          severity: 'medium'
        }
      })
    } catch (emitError) {
      this.logger.error(`❌ Failed to emit feature error event`, emitError)
    }
  }
}
