import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { CharacterService } from '../../../../domains/character/character.service'
import { CharacterCreationService } from './character-creation.service'
import { CharacterNotificationService } from './character-notification.service'

/**
 * Character Event Integration Service
 *
 * CharacterEventHandlerServiceをfeatures/characterEdit/に統合
 * TypedEventServiceで発行されるキャラクター関連イベントを
 * features/内のOrchestratorパターンで処理
 */
@Injectable()
export class CharacterEventIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(CharacterEventIntegrationService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly characterService: CharacterService,
    private readonly characterCreationService: CharacterCreationService,
    private readonly characterNotificationService: CharacterNotificationService
  ) {}

  /**
   * モジュール初期化時にイベントハンドラーを登録
   */
  async onModuleInit(): Promise<void> {
    this.registerEventHandlers()
    this.logger.log('Character Event Integration Service initialized (features/characterEdit/)')
  }

  /**
   * イベントハンドラーを登録
   *
   * 🚨 重複登録問題により無効化済み
   *
   * 注: かつて重複相手だった events 層の update.requested / findBy*.requested の
   *     File-based Event Handlers は dead チェーンとして E-3a で削除済み。
   *     このサービス自体も重複機能として、将来的に削除予定です。
   */
  private registerEventHandlers(): void {
    // 🚨 すべてのイベントリスナーはFile-based Event Handlersに移行済み
    // 重複登録を避けるため、このメソッドでのリスナー登録は無効化

    this.logger.debug('Character event handlers registration skipped (migrated to File-based Event Handlers)')
  }

  // 注: handleCharacterSearchByChannelId / handleCharacterSearchById / handleCharacterUpdateRequest は
  //     listener 未登録・呼び出しゼロの dead private メソッド（dead イベント
  //     character.findBy*.completed/failed・character.update.failed の emit のみ）だったため
  //     E-4a の契約厳密化に伴い削除した。
  // 削除: Event Bridge移行完了によりレガシー処理は不要
  // handleCharacterCreationRequest メソッドは削除されました
  // 新しい処理は character-edit-creation.handler.ts で実行されます
}
