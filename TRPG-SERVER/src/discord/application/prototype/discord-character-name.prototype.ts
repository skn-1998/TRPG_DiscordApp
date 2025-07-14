import { Injectable, Logger } from '@nestjs/common'
import { EventBusService } from '../../../shared/application/event-bus.service'
import { DiscordService } from '../../discord.service'
import {
  CharacterNameUpdateRequestedPrototype,
  CharacterNameUpdatedPrototype,
  CharacterNameUpdateFailedPrototype
} from '../../../domains/character/application/prototype/character-name-events.prototype'

/**
 * プロトタイプ: Discord キャラクター名統合サービス
 * Discord UI の更新とイベント処理を担当
 */
@Injectable()
export class DiscordCharacterNamePrototype {
  private readonly logger = new Logger(DiscordCharacterNamePrototype.name)

  constructor(
    private readonly eventBus: EventBusService,
    private readonly discordService: DiscordService
  ) {
    this.registerEventHandlers()
  }

  /**
   * イベントハンドラーを登録
   */
  private registerEventHandlers(): void {
    this.eventBus.subscribeMany([
      {
        eventName: 'character.name.updated.prototype',
        handler: { handle: this.handleCharacterNameUpdated.bind(this) }
      },
      {
        eventName: 'character.name.update.failed.prototype',
        handler: { handle: this.handleCharacterNameUpdateFailed.bind(this) }
      }
    ])
  }

  /**
   * Discord からのキャラクター名更新要求を処理
   */
  async requestCharacterNameUpdate(channelId: string, newName: string, userId: string): Promise<void> {
    this.logger.log(`[PROTOTYPE] Requesting character name update from Discord: ${channelId}`)

    try {
      await this.eventBus.publish(new CharacterNameUpdateRequestedPrototype(channelId, newName, userId))

      this.logger.log(`[PROTOTYPE] Character name update request sent successfully`)
    } catch (error) {
      this.logger.error(`[PROTOTYPE] Error sending character name update request:`, error)
      throw error
    }
  }

  /**
   * キャラクター名更新成功イベントの処理
   */
  async handleCharacterNameUpdated(event: CharacterNameUpdatedPrototype): Promise<void> {
    this.logger.log(`[PROTOTYPE] Updating Discord UI for character name change: ${event.characterId}`)

    try {
      // Discord Embed の更新
      await this.updateDiscordCharacterEmbed(event)

      // 変更通知の送信
      await this.sendCharacterNameChangeNotification(event)

      this.logger.log(`[PROTOTYPE] Discord UI updated successfully`)
    } catch (error) {
      this.logger.error(`[PROTOTYPE] Error updating Discord UI:`, error)
      // UI更新失敗は致命的エラーではないため、例外を再スローしない
    }
  }

  /**
   * キャラクター名更新失敗イベントの処理
   */
  async handleCharacterNameUpdateFailed(event: CharacterNameUpdateFailedPrototype): Promise<void> {
    this.logger.warn(`[PROTOTYPE] Character name update failed: ${event.errorMessage}`)

    try {
      // エラーメッセージをDiscordに送信
      await this.sendErrorMessage(event)

      this.logger.log(`[PROTOTYPE] Error message sent to Discord`)
    } catch (error) {
      this.logger.error(`[PROTOTYPE] Error sending error message to Discord:`, error)
    }
  }

  /**
   * Discord Embed の更新
   */
  private async updateDiscordCharacterEmbed(event: CharacterNameUpdatedPrototype): Promise<void> {
    try {
      // 既存のDiscordServiceメソッドを使用してEmbed更新
      // 実際の実装では、characterを取得してEmbedを更新する

      // 注意: この実装は実際のDiscordServiceの実装に依存します
      // プロトタイプのため、ログのみ出力
      this.logger.log(`[PROTOTYPE] Would update Discord embed for character: ${event.characterId}`)
      this.logger.log(`[PROTOTYPE] Name changed from "${event.oldName}" to "${event.newName}"`)

      // 実際の実装例 (コメントアウト):
      // await this.discordService.updateCharacterEmbed(event.channelId, {
      //   characterName: event.newName,
      //   oldName: event.oldName
      // })
    } catch (error) {
      this.logger.error(`[PROTOTYPE] Error updating Discord embed:`, error)
      throw error
    }
  }

  /**
   * キャラクター名変更通知の送信
   */
  private async sendCharacterNameChangeNotification(event: CharacterNameUpdatedPrototype): Promise<void> {
    try {
      // 名前変更通知メッセージを作成
      const notificationMessage = `🎭 キャラクター名が更新されました: "${event.oldName}" → "${event.newName}"`

      // 注意: この実装は実際のDiscordServiceの実装に依存します
      // プロトタイプのため、ログのみ出力
      this.logger.log(`[PROTOTYPE] Would send notification: ${notificationMessage}`)

      // 実際の実装例 (コメントアウト):
      // await this.discordService.sendMessage(event.channelId, notificationMessage)
    } catch (error) {
      this.logger.error(`[PROTOTYPE] Error sending character name change notification:`, error)
      throw error
    }
  }

  /**
   * エラーメッセージの送信
   */
  private async sendErrorMessage(event: CharacterNameUpdateFailedPrototype): Promise<void> {
    try {
      // エラーメッセージを作成
      const errorMessage = `❌ キャラクター名の更新に失敗しました: ${event.errorMessage}`

      // 注意: この実装は実際のDiscordServiceの実装に依存します
      // プロトタイプのため、ログのみ出力
      this.logger.log(`[PROTOTYPE] Would send error message: ${errorMessage}`)

      // 実際の実装例 (コメントアウト):
      // await this.discordService.sendEphemeralMessage(event.channelId, errorMessage)
    } catch (error) {
      this.logger.error(`[PROTOTYPE] Error sending error message:`, error)
      throw error
    }
  }
}
