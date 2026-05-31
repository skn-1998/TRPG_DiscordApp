import { Injectable } from '@nestjs/common'
import { EventHandler, EventContext } from 'events/handlers/_shared/event-handler.base'
import { CharacterUIService } from 'discord/features/characterEdit/services/character-ui.service'
import { CharacterDeletionCompletedEvent } from 'events/contracts/unified-event-contracts'

/**
 * character.deletion.completed 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター削除完了時のDiscord UI更新
 * - チャンネルの削除・アーカイブ処理
 * - 削除完了通知の送信
 *
 * ⚠️ 登録方式:
 * - 旧 events 層の EventRegistry でも「未登録（コメントアウト）」だった。
 *   逆流 import を断つため discord 層へ移設したが、挙動保存のため
 *   自己購読は行わない（イベント購読は依然として無効）。
 */
@Injectable()
export class CharacterDeletionCompletedHandler extends EventHandler<CharacterDeletionCompletedEvent> {
  constructor(private readonly characterUIService: CharacterUIService) {
    super()
  }

  /**
   * 処理するイベント名
   */
  getEventName(): string {
    return 'character.deletion.completed'
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterDeletionCompletedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🎭 Processing character deletion completed: ${event.deletedCharacterData.characterName}`)

    try {
      // Discord UI更新処理
      await this.updateDiscordUI(event, context)

      this.logger.log(`✅ Character deletion UI cleanup completed: ${event.characterId}`)
    } catch (error) {
      this.logger.error(
        `❌ Character deletion UI cleanup failed: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * Discord UI更新処理
   */
  private async updateDiscordUI(event: CharacterDeletionCompletedEvent, context?: EventContext): Promise<void> {
    const { deletedCharacterData } = event

    // 1. 削除完了通知の送信（チャンネルが存在する場合）
    if (deletedCharacterData.discordChannelId) {
      try {
        await this.characterUIService.sendCharacterDeletionNotification(
          deletedCharacterData.discordChannelId,
          deletedCharacterData.characterName,
          deletedCharacterData.discordUserId
        )
        this.logger.debug(`✅ Deletion notification sent successfully`)
      } catch (error) {
        this.logger.warn(`⚠️ Deletion notification failed: ${error instanceof Error ? error.message : String(error)}`)
        // 通知の失敗は致命的ではないため、処理を続行
      }
    }

    // 2. チャンネルの処理（削除またはアーカイブ）
    if (deletedCharacterData.discordChannelId) {
      try {
        // 設定に応じてチャンネルを削除またはアーカイブ
        await this.handleChannelCleanup(deletedCharacterData.discordChannelId, deletedCharacterData.characterName)
        this.logger.debug(`✅ Channel cleanup completed successfully`)
      } catch (error) {
        this.logger.warn(`⚠️ Channel cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
        // チャンネル処理の失敗は致命的ではないため、処理を続行
      }
    }

    // 3. 関連するEmbedメッセージの削除・更新
    if (deletedCharacterData.discordChannelId) {
      try {
        await this.characterUIService.removeCharacterEmbeds(deletedCharacterData.discordChannelId)
        this.logger.debug(`✅ Character embeds removed successfully`)
      } catch (error) {
        this.logger.warn(
          `⚠️ Character embeds removal failed: ${error instanceof Error ? error.message : String(error)}`
        )
        // Embed削除の失敗は致命的ではないため、処理を続行
      }
    }
  }

  /**
   * チャンネルのクリーンアップ処理
   */
  private async handleChannelCleanup(channelId: string, characterName: string): Promise<void> {
    // TODO: 設定によって削除かアーカイブかを選択
    // 現在は安全のためアーカイブを実行

    try {
      // チャンネル名を変更してアーカイブ状態を示す
      const archivedChannelName = `🗄️-archived-${characterName.toLowerCase().replace(/\s+/g, '-')}`

      await this.characterUIService.updateChannelName(channelId, archivedChannelName)
      await this.characterUIService.archiveChannel(channelId)

      this.logger.debug(`Channel archived with name: ${archivedChannelName}`)
    } catch (error) {
      this.logger.warn(
        `Channel archiving failed, attempting alternate cleanup: ${error instanceof Error ? error.message : String(error)}`
      )

      // アーカイブに失敗した場合の代替処理
      try {
        await this.characterUIService.addChannelArchiveEmoji(channelId)
        this.logger.debug(`Channel marked with archive emoji as fallback`)
      } catch (fallbackError) {
        this.logger.error(
          `All channel cleanup methods failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
        )
        throw fallbackError
      }
    }
  }

  /**
   * リトライ可能エラーの判定
   */
  protected isRetryableError(error: Error): boolean {
    // Discord API関連のエラーはリトライ可能
    if (error instanceof Error && (error.message.includes('Discord') || error.message.includes('API'))) {
      return true
    }

    // チャンネル削除関連のエラーはリトライ可能
    if (error instanceof Error && (error.message.includes('channel') || error.message.includes('permission'))) {
      return true
    }

    return super.isRetryableError(error)
  }

  /**
   * 最大リトライ回数
   */
  protected getMaxRetries(): number {
    return 3 // チャンネル削除は重要な処理のため、リトライ回数を多めに設定
  }
}
