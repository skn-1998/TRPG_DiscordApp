import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../../../../shared/application/typed-event.service'
import { GlobalEventBusService } from '../../../../../events'
import { EventPayload } from '../../../../../shared/domain/events/event-contracts'

/**
 * Character Edit Feature Event Handler
 * characterEdit機能内部のイベントハンドラー
 * Feature内部イベントとグローバルイベントの橋渡し
 */
@Injectable()
export class CharacterEditFeatureHandler implements OnModuleInit {
  private readonly logger = new Logger(CharacterEditFeatureHandler.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly globalEventBus: GlobalEventBusService
  ) {}

  onModuleInit(): void {
    this.registerFeatureEventHandlers()
    this.logger.log('Character Edit Feature Handler initialized')
  }

  /**
   * Feature内部イベントハンドラー登録
   */
  private registerFeatureEventHandlers(): void {
    // Modal Events
    this.typedEventService.on('characterEdit.modal.opened', this.handleModalOpened.bind(this))
    this.typedEventService.on('characterEdit.modal.submitted', this.handleModalSubmitted.bind(this))

    // Validation Events
    this.typedEventService.on('characterEdit.validation.completed', this.handleValidationCompleted.bind(this))

    // Embed Events
    this.typedEventService.on('characterEdit.embed.refresh.requested', this.handleEmbedRefreshRequested.bind(this))

    // Session Events
    this.typedEventService.on('characterEdit.session.created', this.handleSessionCreated.bind(this))

    // Error Events
    this.typedEventService.on('characterEdit.error.occurred', this.handleFeatureError.bind(this))

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
      // ここではイベントログ記録とワークフロー管理のみ

      // グローバルキャラクター更新イベント発行
      await this.globalEventBus.emit({
        type: 'character.update.requested',
        characterId: event.characterId,
        timestamp: new Date(),
        source: 'discord',
        userId: event.userId,
        updateData: {
          [event.modal.sectionType]: {
            [event.modal.fieldKey]: event.modal.newValue
          }
        }
      })

      // Embed更新リクエスト発行
      await this.typedEventService.emit('characterEdit.embed.refresh.requested', {
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
   * バリデーション完了イベントハンドラー
   */
  private async handleValidationCompleted(event: EventPayload<'characterEdit.validation.completed'>): Promise<void> {
    const status = event.validation.isValid ? '✅' : '❌'
    this.logger.debug(`${status} Validation Completed: ${event.validation.fieldKey}`)

    try {
      if (!event.validation.isValid) {
        // バリデーション失敗時の処理
        this.logger.warn(`Validation failed for ${event.validation.fieldKey}: ${event.validation.errors?.join(', ')}`)

        // 必要に応じてユーザーへのフィードバック処理
        // 例: Discord ephemeral messageの送信など
      }
    } catch (error) {
      this.logger.error(`❌ Validation completed event processing failed`, error)
      await this.emitFeatureError('VALIDATION_COMPLETED_HANDLER_ERROR', error, event)
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
      await this.globalEventBus.emit({
        type: 'discord.embed.update.requested',
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
   * セッション作成イベントハンドラー
   */
  private async handleSessionCreated(event: EventPayload<'characterEdit.session.created'>): Promise<void> {
    this.logger.debug(`🔐 Session Created: ${event.session.sessionId}`)

    try {
      // セッション管理処理
      // 例: セッション有効期限の設定、クリーンアップスケジューリングなど

      this.logger.debug(`Session ${event.session.sessionId} expires at ${event.session.expiresAt}`)
    } catch (error) {
      this.logger.error(`❌ Session created event processing failed`, error)
      await this.emitFeatureError('SESSION_CREATED_HANDLER_ERROR', error, event)
    }
  }

  /**
   * Feature内エラーイベントハンドラー
   */
  private async handleFeatureError(event: EventPayload<'characterEdit.error.occurred'>): Promise<void> {
    this.logger.error(`🚨 Character Edit Feature Error: ${event.error.code} - ${event.error.message}`)

    try {
      // 重要度に基づいてグローバルエラーイベント発行
      if (event.error.severity === 'high') {
        await this.globalEventBus.emit({
          type: 'system.error.occurred',
          timestamp: new Date(),
          source: 'system',
          error: {
            code: event.error.code,
            message: event.error.message,
            context: {
              feature: 'characterEdit',
              operation: event.error.operation,
              characterId: event.characterId,
              details: event.error.details
            },
            severity: event.error.severity === 'high' ? 'high' : 'medium'
          }
        })
      }
    } catch (error) {
      this.logger.error(`❌ Feature error event processing failed`, error)
    }
  }

  /**
   * Feature内エラーイベント発行ヘルパー
   */
  private async emitFeatureError(code: string, error: any, originalEvent: any): Promise<void> {
    try {
      await this.typedEventService.emit('characterEdit.error.occurred', {
        characterId: originalEvent.characterId,
        timestamp: new Date(),
        userId: originalEvent.userId,
        error: {
          code,
          message: error.message || 'Unknown error',
          operation: originalEvent.type,
          details: { originalEvent, stack: error.stack },
          severity: 'medium'
        }
      })
    } catch (emitError) {
      this.logger.error(`❌ Failed to emit feature error event`, emitError)
    }
  }
}
