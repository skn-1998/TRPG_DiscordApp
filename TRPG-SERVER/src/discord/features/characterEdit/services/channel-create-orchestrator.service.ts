import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { EventPayload } from '../../../../events/contracts'
import { ChannelDetectionService } from './channel-detection.service'
import { CharacterCreationService } from './character-creation.service'
import { CharacterNotificationService } from './character-notification.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { DiscordClientService } from '../../../services/discord-client.service'
import { CharacterUIService } from './character-ui.service'

// ============================================================================
// Main Orchestrator Service
// ============================================================================

@Injectable()
export class ChannelCreateOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(ChannelCreateOrchestratorService.name)

  constructor(
    private readonly channelDetectionService: ChannelDetectionService,
    private readonly characterCreationService: CharacterCreationService,
    private readonly characterNotificationService: CharacterNotificationService,
    private readonly typedEventService: TypedEventService,
    private readonly characterUIService: CharacterUIService,
    private readonly discordClientService: DiscordClientService
  ) {}

  /**
   * サービス初期化 - イベントリスナーの登録
   *
   * 🚨 File-based Event Handlersへの移行により無効化済み
   *
   * 理由: 以下のイベントリスナーはFile-based Event Handlersで処理済み：
   * - character.creation.completed → CharacterCreationCompletedChannelOrchestratorHandler
   * - character.creation.failed → CharacterCreationFailedChannelOrchestratorHandler
   *
   * チャンネル同期とエラーハンドリングはFile-based Event Handlersで実行されます。
   */
  onModuleInit(): void {
    // 🚨 すべてのイベントリスナーはFile-based Event Handlersに移行済み
    // 重複登録を避けるため、このメソッドでのリスナー登録は無効化

    this.logger.debug(
      'Channel Create Orchestrator event listeners registration skipped (migrated to File-based Event Handlers)'
    )
  }

  /**
   * メイン実行メソッド - 責任の分離によりシンプルに
   */
  async execute(channel: TextChannel): Promise<void> {
    try {
      // 1. チャンネル検出
      const detectionResult = await this.channelDetectionService.detectCharacterChannel(channel)

      if (!detectionResult.success) {
        this.logger.error('チャンネル検出に失敗:', detectionResult.error)
        return
      }

      if (!detectionResult.shouldCreateCharacter || !detectionResult.context) {
        return
      }

      // 2. キャラクター作成イベント発火 (イベント駆動アーキテクチャ)
      this.logger.log('キャラクター作成イベントを発火します')

      await this.typedEventService.emit('character.creation.requested', {
        createData: {
          characterName: detectionResult.context.channel.name,
          gameSystemId: '', // デフォルト値
          discordUserId: detectionResult.context.creatorId || '',
          discordChannelId: detectionResult.context.channel.id
        },
        requester: {
          featureId: 'characterEdit',
          context: {
            channelId: detectionResult.context.channel.id,
            sectionType: 'basic',
            triggeredBy: 'channel_create'
          }
        },
        userId: detectionResult.context.creatorId || '',
        source: 'channel-create-orchestrator',
        timestamp: new Date()
      })

      // 以降の処理（チャンネル名同期・通知）はイベントハンドラーで実行

      this.logger.log('キャラクター作成イベントを発火しました。後続処理はイベントハンドラーで実行されます。')
    } catch (error) {
      this.logger.error('チャンネル作成処理で予期しないエラーが発生:', error)
    }
  }

  /**
   * キャラクター作成成功イベントハンドラー
   */
  private async handleCharacterCreationCompleted(payload: EventPayload<'character.creation.completed'>): Promise<void> {
    try {
      const character = payload.character
      this.logger.log(`キャラクター作成成功: ${character.characterName} (ID: ${character.characterId})`)

      // Discordチャンネルの取得
      const client = this.discordClientService.getClient()
      if (!client) {
        this.logger.warn('Discord client not available')
        return
      }

      const channel = await client.channels.fetch(character.discordChannelId)
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(`チャンネルが見つかりません: ${character.discordChannelId}`)
        return
      }

      // 1. チャンネル名をキャラクター名に同期
      const sanitizedChannelName = this.sanitizeChannelName(character.characterName)

      const textChannel = channel as TextChannel
      if (textChannel.name !== sanitizedChannelName) {
        try {
          await textChannel.setName(sanitizedChannelName, `キャラクター名を反映: ${character.characterName}`)
          this.logger.log(
            `チャンネル名をキャラクター名に同期しました: ${character.characterName} → ${sanitizedChannelName}`
          )
        } catch (error) {
          this.logger.warn(`チャンネル名の同期に失敗しました: ${character.characterName}`, error)
        }
      }

      // 2. 通知送信
      await this.characterNotificationService.notifyCharacterCreation(
        textChannel,
        character.characterId,
        character.characterName
      )

      // 3. CharacterEdit Embed作成はCharacter Event Handlerで自動実行されるため省略
      this.logger.log(
        'チャンネル作成処理が正常に完了しました（CharacterEdit Embedは別途Character Event Handlerで自動作成）'
      )
    } catch (error) {
      this.logger.error('キャラクター作成成功イベントの処理中にエラーが発生:', error)
    }
  }

  /**
   * キャラクター作成失敗イベントハンドラー
   */
  private async handleCharacterCreationFailed(payload: EventPayload<'character.creation.failed'>): Promise<void> {
    this.logger.error(`キャラクター作成失敗: ${payload.error}`)
    this.logger.debug('失敗した作成データ:', payload.createData)
  }

  /**
   * チャンネルIDからTextChannelオブジェクトを取得するヘルパーメソッド
   * 現在は DiscordUIService の getTextChannel を使用しているため不要
   * @deprecated Use discordUIService.getTextChannel() instead
   */

  /**
   * チャンネル名をDiscordの制約に合わせてサニタイズ
   */
  private sanitizeChannelName(characterName: string): string {
    // Discordチャンネル名の制約:
    // - 2-100文字
    // - 小文字、数字、ハイフン、アンダースコア、日本語のみ
    // - スペースは使用不可
    let sanitized = characterName
      .toLowerCase()
      .replace(/\s+/g, '-') // スペースをハイフンに変換
      .replace(/[^\w\-ぁ-んァ-ヶー一-龯]/g, '') // 無効文字を除去
      .slice(0, 100) // 最大100文字

    // 最低2文字必要
    if (sanitized.length < 2) {
      sanitized = `character-${sanitized}`.slice(0, 100)
    }

    // ハイフンで開始・終了することはできない
    sanitized = sanitized.replace(/^-+|-+$/g, '')
    if (sanitized.length < 2) {
      sanitized = 'character'
    }

    return sanitized
  }
}
