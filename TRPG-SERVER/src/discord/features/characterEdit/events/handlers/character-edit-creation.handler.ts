import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../../../../shared/application/typed-event.service'
import { CharacterService } from '../../../../../domains/character/character.service'
import { CharacterCreationService } from '../../services/character-creation.service'
import { CharacterNotificationService } from '../../services/character-notification.service'
import {
  CharacterEditCreationRequestedEvent,
  CharacterEditCreationCompletedEvent,
  CharacterEditCreationFailedEvent
} from '../contracts/character-edit-events.contract'

/**
 * Character Edit Creation Handler
 *
 * 🎯 目的: characterEdit feature内でのキャラクター作成処理
 *
 * 📋 責務:
 * - characterEdit.creation.requested イベントの処理
 * - characterEdit固有の作成前処理・後処理
 * - 作成結果の Feature Events 発行
 * - Event Bridge経由のrequester情報の保持・転送
 *
 * 🏗️ Event Bridge統合:
 * - Global Events → Feature Events変換後の処理
 * - originalRequester情報を適切に保持・転送
 * - 完了/失敗イベントはEvent Bridge経由でGlobalに集約
 */
@Injectable()
export class CharacterEditCreationHandler implements OnModuleInit {
  private readonly logger = new Logger(CharacterEditCreationHandler.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly characterService: CharacterService,
    private readonly characterCreationService: CharacterCreationService,
    private readonly characterNotificationService: CharacterNotificationService
  ) {}

  /**
   * モジュール初期化: イベントハンドラー登録
   */
  async onModuleInit(): Promise<void> {
    this.typedEventService.on('characterEdit.creation.requested', this.handleCreationRequest.bind(this))

    this.logger.log('CharacterEdit Creation Handler initialized')
  }

  /**
   * キャラクター作成リクエスト処理
   */
  async handleCreationRequest(event: CharacterEditCreationRequestedEvent): Promise<void> {
    const { createData, editContext, originalRequester, ...baseEvent } = event

    this.logger.debug(
      `[CHARACTER-EDIT-CREATION] 作成リクエスト: ${createData.characterName} (channel: ${editContext.channelId})`
    )

    try {
      // 1. characterEdit固有の事前バリデーション
      const validatedData = await this.validateEditCreationData(createData, editContext)

      // characterId が空の場合は生成
      if (!validatedData.characterId) {
        validatedData.characterId = `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      // 2. キャラクター作成実行
      const character = await this.characterService.create(validatedData)

      // 3. characterEdit固有の後処理
      await this.setupEditEnvironment(character, editContext)

      // 4. 作成完了通知
      await this.characterNotificationService.notifyCharacterCreated(
        character.characterId,
        editContext.channelId,
        baseEvent.userId || ''
      )

      // 5. Feature Events完了イベント発行
      await (this.typedEventService as any).emit('characterEdit.creation.completed', {
        type: 'characterEdit.creation.completed',
        characterId: character.characterId,
        character,
        editContext,
        originalRequester,
        timestamp: new Date(),
        userId: baseEvent.userId,
        sessionId: baseEvent.sessionId
      } as CharacterEditCreationCompletedEvent)

      this.logger.debug(`CharacterEdit creation completed: ${character.characterId}`)
    } catch (error) {
      this.logger.error(`CharacterEdit creation failed: ${createData.characterName}`, error)

      // 6. Feature Events失敗イベント発行
      await (this.typedEventService as any).emit('characterEdit.creation.failed', {
        type: 'characterEdit.creation.failed',
        characterId: createData.characterName, // 失敗時はcharacterIdが未確定
        createData,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          details: error
        },
        editContext,
        originalRequester,
        timestamp: new Date(),
        userId: baseEvent.userId,
        sessionId: baseEvent.sessionId
      } as CharacterEditCreationFailedEvent)
    }
  }

  /**
   * characterEdit固有の作成データバリデーション
   */
  private async validateEditCreationData(createData: any, editContext: any): Promise<any> {
    // channelIdの設定・検証
    const validatedData = {
      ...createData,
      discordChannelId: editContext.channelId, // edit機能では必須
      characterId: createData.characterId || '', // 空文字列をデフォルトに
      discordUserId: createData.discordUserId || '' // 必須フィールド
    }

    // sectionTypeに応じた追加バリデーション
    if (editContext.sectionType) {
      switch (editContext.sectionType) {
        case 'status':
          // status作成時の特別な検証
          break
        case 'parameter':
          // parameter作成時の特別な検証
          break
        case 'skill':
          // skill作成時の特別な検証
          break
        case 'item':
          // item作成時の特別な検証
          break
        default:
          // basic作成時のデフォルト検証
          break
      }
    }

    return validatedData
  }

  /**
   * characterEdit固有の環境セットアップ
   */
  private async setupEditEnvironment(character: any, editContext: any): Promise<void> {
    try {
      // チャンネルへのキャラクターシート表示設定
      // TODO: setupCharacterSheetメソッドの実装または代替処理
      this.logger.debug(`Character sheet setup for ${character.characterId} in channel ${editContext.channelId}`)

      // triggeredByに応じた後処理
      if (editContext.triggeredBy === 'channel_create') {
        // チャンネル作成経由の場合の特別な処理
        await this.setupChannelBasedEdit(character, editContext)
      }

      this.logger.debug(`Edit environment setup completed for ${character.characterId}`)
    } catch (error) {
      this.logger.warn(`Edit environment setup failed for ${character.characterId}`, error)
      // 環境セットアップ失敗は作成失敗とはしない（キャラクターは作成済み）
    }
  }

  /**
   * チャンネル作成経由の特別なセットアップ
   */
  private async setupChannelBasedEdit(character: any, editContext: any): Promise<void> {
    // チャンネル作成経由の場合の追加設定
    // 例: デフォルトセクション表示、初期メッセージ送信等
    this.logger.debug(`Channel-based edit setup for ${character.characterId}`)
  }
}
