import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { CharacterService } from '../../../../domains/character/character.service'
import { CharacterCreationService } from './character-creation.service'
import { CharacterNotificationService } from './character-notification.service'
import { TextChannel } from 'discord.js'

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
   */
  private registerEventHandlers(): void {
    // キャラクター検索リクエストハンドラー
    this.typedEventService.on('character.findByChannelId.requested', async (payload) => {
      await this.handleCharacterSearchByChannelId(payload)
    })

    // 実際にサポートされているイベントのみ登録
    this.logger.debug('Character event handlers registered in features/characterEdit/')
  }

  /**
   * チャンネルIDによるキャラクター検索を処理
   */
  private async handleCharacterSearchByChannelId(payload: any): Promise<void> {
    const { channelId } = payload

    this.logger.debug(`[CHARACTER-SEARCH] チャンネルID検索: ${channelId}`)

    try {
      const character = await this.characterService.findByChannelId(channelId)
      this.logger.debug(`キャラクター検索結果:`, character)
    } catch (error) {
      this.logger.error(`チャンネルID検索エラー: ${channelId}`, error)
    }
  }
}
