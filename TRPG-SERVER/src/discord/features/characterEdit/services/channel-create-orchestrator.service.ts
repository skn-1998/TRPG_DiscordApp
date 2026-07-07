import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { EventPayload, EVENT_NAMES } from '../../../../events/contracts'
import { ChannelDetectionService } from './channel-detection.service'
import { CharacterNotificationService } from './character-notification.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { DiscordClientService } from '../../../services/discord-client.service'

// ============================================================================
// Main Orchestrator Service
// ============================================================================

@Injectable()
export class ChannelCreateOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(ChannelCreateOrchestratorService.name)

  constructor(
    private readonly channelDetectionService: ChannelDetectionService,
    private readonly characterNotificationService: CharacterNotificationService,
    private readonly typedEventService: TypedEventService,
    private readonly discordClientService: DiscordClientService
  ) {}

  /**
   * サービス初期化 - イベントリスナーの登録
   *
   * 🚨 File-based Event Handlersへの移行により無効化済み
   *
   * 理由: character.creation.completed の購読は discord/events/handlers の
   * CharacterCreationCompletedHandler（自己購読）が担う。
   * （旧 character.creation.failed 連鎖は購読者ゼロの dead としてE-3/E-4aで契約ごと撤去済み）
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

      await this.typedEventService.emit(EVENT_NAMES.CHARACTER_CREATION_REQUESTED, {
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
   *
   * 注: リスナー登録は File-based Event Handlers へ移行済みで本体からの呼び出しはないが、
   *     spec が直接呼び出してテストしているため C-9 では削除せず protected で保持
   *     （noUnusedLocals は private メンバのみ検査対象）。
   */
  protected async handleCharacterCreationCompleted(
    payload: EventPayload<'character.creation.completed'>
  ): Promise<void> {
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

  // 注: handleCharacterCreationFailed は listener 未登録・呼び出しゼロの E-3 残骸
  //     （dead contract 'character.creation.failed' 型参照のみ）だったため E-4a で削除した。

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
