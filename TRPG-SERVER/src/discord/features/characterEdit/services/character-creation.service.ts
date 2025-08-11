import { Injectable, Logger } from '@nestjs/common'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { ChannelCreationContext } from './channel-detection.service'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CharacterCreationResult {
  success: boolean
  characterId?: string
  characterName?: string
  error?: string
}

// ============================================================================
// Character Creation Service
// ============================================================================

@Injectable()
export class CharacterCreationService {
  private readonly logger = new Logger(CharacterCreationService.name)

  constructor(private readonly typedEventService: TypedEventService) {}

  /**
   * キャラクター作成処理 - イベント駆動版
   */
  async createCharacter(context: ChannelCreationContext): Promise<CharacterCreationResult> {
    try {
      this.logger.log(`キャラクター作成イベントを発火: ${context.channel.name}`)

      // キャラクター作成イベントを発行
      await this.typedEventService.emit('character.creation.requested', {
        createData: {
          characterId: '', // サービス側で生成
          characterName: context.channel.name,
          gameSystemId: '', // デフォルト値
          discordChannelId: context.channel.id,
          discordUserId: context.creatorId || ''
        },
        userId: context.creatorId || '',
        source: 'character-creation-service',
        timestamp: new Date()
      })

      if (!context.creatorId) {
        this.logger.warn('注意: discordUserIdは取得できませんでした。後で設定してください。')
      }

      // イベント駆動のため、イベントが処理されることを想定した成功レスポンス
      this.logger.log('キャラクター作成イベントが正常に発行されました')
      return {
        success: true,
        characterId: 'pending', // 実際のIDはイベントハンドラーから取得
        characterName: context.channel.name
      }
    } catch (error) {
      this.logger.error('キャラクター作成イベント発行エラー:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
