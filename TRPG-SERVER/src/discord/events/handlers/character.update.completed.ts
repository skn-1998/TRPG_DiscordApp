import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventHandler, EventContext } from 'events/handlers/_shared/event-handler.base'
import { CharacterUIService } from 'discord/features/characterEdit/services/character-ui.service'
import { ThreadOrchestratorService } from 'discord/features/characterThread/services/thread-orchestrator.service'
import { CharacterUpdateCompletedEvent } from 'events/contracts/unified-event-contracts'
import { TypedEventService } from 'shared/application/typed-event.service'

/**
 * character.update.completed 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター更新完了時のDiscord UI更新
 * - チャンネルEmbedの更新
 * - 更新完了通知の送信
 *
 * 🏗️ 登録方式:
 * - discord 層へ移設し、OnModuleInit で TypedEventService に自己購読する
 *   （旧: events 層の EventRegistryService による集中登録）
 * - EventHandler 基底の execute()（検証・ログ・統計・リトライ）は維持
 */
@Injectable()
export class CharacterUpdateCompletedHandler
  extends EventHandler<CharacterUpdateCompletedEvent>
  implements OnModuleInit
{
  constructor(
    private readonly characterUIService: CharacterUIService,
    private readonly threadOrchestratorService: ThreadOrchestratorService,
    private readonly typedEventServiceLocal: TypedEventService
  ) {
    super()
  }

  /**
   * モジュール初期化: TypedEventService への自己購読
   */
  onModuleInit(): void {
    this.setTypedEventService(this.typedEventServiceLocal)
    this.typedEventServiceLocal.on(this.getEventName(), (event) => this.execute(event))
  }

  /**
   * 処理するイベント名
   */
  getEventName(): string {
    return 'character.update.completed'
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterUpdateCompletedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🎭 Processing character update completed: ${event.character.characterName}`)

    try {
      // Discord UI更新処理
      await this.updateDiscordUI(event, context)

      this.logger.log(`✅ Character update UI refresh completed: ${event.character.characterId}`)
    } catch (error) {
      this.logger.error(
        `❌ Character update UI refresh failed: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * Discord UI更新処理
   */
  private async updateDiscordUI(event: CharacterUpdateCompletedEvent, context?: EventContext): Promise<void> {
    const { character } = event
    const updatedFields = (event as any).updatedFields as string[] | undefined

    // 1. チャンネルが存在する場合、Embedを更新
    if (character.discordChannelId) {
      this.logger.debug(`Updating character embed in channel: ${character.discordChannelId}`)

      try {
        await this.characterUIService.updateCharacterEmbed(character.discordChannelId, character as any)
        this.logger.debug(`✅ Character embed updated successfully`)
      } catch (error) {
        this.logger.warn(`⚠️ Character embed update failed: ${error instanceof Error ? error.message : String(error)}`)
        // Embed更新の失敗は致命的ではないため、処理を続行
      }
    }

    // // 2. 重要な更新の場合は通知を送信
    // if (character.discordChannelId && this.shouldNotifyUpdate(updatedFields)) {
    //   try {
    //     await this.characterUIService.sendCharacterUpdateNotification(
    //       character.discordChannelId,
    //       character as any,
    //       updatedFields || [],
    //       character.discordUserId
    //     )
    //     this.logger.debug(`✅ Update notification sent successfully`)
    //   } catch (error) {
    //     this.logger.warn(`⚠️ Update notification failed: ${error instanceof Error ? error.message : String(error)}`)
    //     // 通知の失敗は致命的ではないため、処理を続行
    //   }
    // }

    // 3. スレッドが存在する場合、Thread内のEmbedを更新
    if (character.discordThreadId) {
      this.logger.debug(`Updating character thread display in thread: ${(character as any).discordThreadId}`)

      try {
        await this.threadOrchestratorService.updateCharacterThreadDisplay(character as any)
        this.logger.debug(`✅ Character thread display updated successfully`)
      } catch (error) {
        this.logger.warn(
          `⚠️ Character thread display update failed: ${error instanceof Error ? error.message : String(error)}`
        )
        // Thread Embed更新の失敗は致命的ではないため、処理を続行
      }
    }

    // 4. ステータス変更の場合はステータス表示を更新
    if (updatedFields?.includes('status') && character.discordChannelId) {
      try {
        await this.characterUIService.updateChannelStatusDisplay(character.discordChannelId, character as any)
        this.logger.debug(`✅ Channel status display updated successfully`)
      } catch (error) {
        this.logger.warn(
          `⚠️ Channel status display update failed: ${error instanceof Error ? error.message : String(error)}`
        )
        // ステータス表示更新の失敗は致命的ではないため、処理を続行
      }
    }
  }

  /**
   * 更新内容に基づいて通知が必要かどうかを判定
   */
  private shouldNotifyUpdate(updatedFields?: string[]): boolean {
    if (!updatedFields || updatedFields.length === 0) {
      return false
    }

    // 重要なフィールドの更新時のみ通知
    const importantFields = ['characterName', 'status', 'level', 'hp', 'mp', 'gameSystemId']

    return updatedFields.some((field) => importantFields.includes(field))
  }

  /**
   * リトライ可能エラーの判定
   */
  protected isRetryableError(error: Error): boolean {
    // Discord API関連のエラーはリトライ可能
    if (error.message.includes('Discord') || error.message.includes('API')) {
      return true
    }

    return super.isRetryableError(error)
  }

  /**
   * 最大リトライ回数
   */
  protected getMaxRetries(): number {
    return 2 // Discord API呼び出しのため控えめに設定
  }
}
